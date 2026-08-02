# Handoff: Google Calendar Custom Hex Color — Root Cause & Fix

**Dự án:** IUH Dashboard (Chrome Extension → Google Apps Script Web App → Google Calendar)
**Trạng thái:** Đã xác định nguyên nhân, đã vá code. Chờ người dùng deploy + xác minh trên tài khoản GAS thật.

---

## 1. Bối cảnh

Extension cào lịch học từ website trường, gửi payload qua `doPost` tới một GAS Web App. Mỗi event trong payload có field `calendarColorHex` (hex tự do, ví dụ `#616161`), người dùng chọn màu này qua color picker trong UI extension — **không phải** 1 trong 11/24 màu mặc định (`colorId`) của Google Calendar.

Pipeline: `UI (chọn hex) → chrome.storage.sync → bridge.js → content.js (đóng gói payload, POST) → GAS Code.js (doPost) → CalendarApp.createEvent() + Calendar Advanced Service (Label API) → Google Calendar`.

**Triệu chứng:** Mọi event luôn ra màu mặc định của calendar (default color), bất kể hex đã cấu hình là gì. Không có exception nào văng ra ngoài — `doPost` vẫn trả `"SYNC SUCCESS"`.

## 2. Vì sao dùng Label API thay vì `colorId`

- `Events.colorId` chỉ nhận 1 trong 11 giá trị cố định (index-based) — không thể set hex tuỳ ý.
- Không có field `backgroundColor` ghi trực tiếp được trên `Events` resource — set field này sẽ bị API bỏ qua/lỗi âm thầm.
- Google Calendar API **có hỗ trợ hex tự do thông qua Label API** (`labelProperties` trên `Calendars` resource + `eventLabelId` trên `Events` resource), GA giữa năm 2026. Đây là hướng đi đúng, **không phải** giải pháp ảo/không tồn tại — xác nhận qua tài liệu chính thức: `https://developers.google.com/workspace/calendar/api/guides/labels`.
- **Không dùng** cách map hex sang màu gần nhất trong 11 màu mặc định (Euclidean distance) — người dùng yêu cầu khớp hex 100%, không chấp nhận xấp xỉ.

## 3. Nguyên nhân gốc đã xác định

Sau khi đọc trực tiếp `Code.js`, phát hiện 2 lỗi cụ thể (không phải suy đoán chung chung):

### 3.1. `id` của label KHÔNG phải UUID hợp lệ (lỗi chính, mức tin cậy cao)

Code cũ sinh id kiểu:
```js
id: 'iuh_color_' + hex.replace('#', '').toLowerCase()   // => "iuh_color_616161"
```

Mọi ví dụ chính thức của Google cho `labelProperties.eventLabels[].id` đều dùng UUID chuẩn (`"42617328-8756-4291-8273-192837465647"`). API validate định dạng này; một chuỗi tuỳ ý gần như chắc chắn bị Google trả lỗi 400 khi gọi `Calendars.patch()`.

Vì lệnh này nằm trong `try { ... } catch (labelErr) { console.warn(...) }`, lỗi 400 bị nuốt, label không bao giờ thực sự được tạo trên calendar. Bước sau đó (`Events.patch({eventLabelId: labelId}, ...)`) tham chiếu tới 1 label không tồn tại → cũng fail và bị nuốt tương tự → event giữ màu mặc định, không có exception nào lộ ra ngoài `doPost`.

**Sửa:** dùng `Utilities.getUuid()` để sinh id, cache map `hex → labelId` qua `PropertiesService` để không tạo trùng label giữa các lần sync.

### 3.2. Manifest thiếu `oauthScopes` tường minh (nguyên nhân phụ, cần loại trừ)

`appsscript.json` không khai báo `oauthScopes`, nghĩa là Apps Script tự dò quyền cần thiết. Nếu logic ghi `labelProperties` (thao tác ở **cấp Calendar**, cần quyền rộng hơn thao tác event thông thường) được thêm **sau** lần authorize đầu tiên, tài khoản deploy có thể chưa từng được cấp quyền tương ứng → mọi lệnh liên quan `labelProperties` bị từ chối (403), cũng bị nuốt trong cùng khối `try/catch`.

**Sửa:** thêm tường minh:
```json
"oauthScopes": ["https://www.googleapis.com/auth/calendar"]
```
rồi bắt buộc authorize lại (xem mục 5).

## 4. Diff logic đã áp dụng trong `Code.js`

```js
// TRƯỚC — id không phải UUID, không cache, log bị nuốt (console.warn + chỉ .message)
const calData = Calendar.Calendars.get(calendarId, { eventLabelVersion: 1 });
...
newLabels.push({
  id: 'iuh_color_' + hex.replace('#', '').toLowerCase(),
  backgroundColor: hex,
  name: 'IUH Color ' + hex
});
...
Calendar.Calendars.patch({ labelProperties: { eventLabels: newLabels } }, calendarId, { eventLabelVersion: 1 });
```

```js
// SAU — UUID hợp lệ, cache qua PropertiesService, log đầy đủ message+stack
const scriptProps = PropertiesService.getScriptProperties();
const cachedMap = JSON.parse(scriptProps.getProperty('IUH_HEX_LABEL_MAP') || '{}');
const calData = Calendar.Calendars.get(calendarId); // không cần eventLabelVersion khi GET

existingLabels.forEach(l => { hexToLabelId[l.backgroundColor.toLowerCase()] = l.id; });

uniqueColors.forEach(hex => {
  const key = hex.toLowerCase();
  if (hexToLabelId[key]) return;
  const id = cachedMap[key] || Utilities.getUuid();     // UUID thật
  newLabels.push({ id, backgroundColor: hex, name: 'IUH Color ' + hex });
  hexToLabelId[key] = id;
  cachedMap[key] = id;
});

Calendar.Calendars.patch({ labelProperties: { eventLabels: newLabels } }, calendarId); // eventLabelVersion KHÔNG cần cho Calendars
scriptProps.setProperty('IUH_HEX_LABEL_MAP', JSON.stringify(cachedMap));
Utilities.sleep(500); // đệm phòng propagation delay
```

Ở bước gán màu cho từng event, dùng lại `hexToLabelId` đã build sẵn thay vì tự suy ra id từ hex lần nữa, và đổi `console.warn(err.message)` → `console.error(err.message + stack)` để lộ rõ nguyên nhân thật trong Executions log nếu vẫn fail.

## 5. Checklist triển khai bắt buộc (thứ tự quan trọng)

1. Dán `Code.js` đã sửa vào Apps Script Editor.
2. Sửa `appsscript.json`: thêm `oauthScopes: ["https://www.googleapis.com/auth/calendar"]`.
3. Chọn 1 hàm bất kỳ trong editor → **Run** trực tiếp → xác nhận popup "Authorization required" xuất hiện → **Allow**. Nếu popup không xuất hiện, quyền chưa thay đổi thật — cần kiểm tra lại.
4. **Deploy → Manage deployments → Edit → New version → Deploy.** Sửa code/manifest không tự áp dụng cho deployment đang chạy.
5. Trigger sync từ extension.
6. Mở **Apps Script Editor → Executions**, đọc log lần chạy gần nhất.
7. (Tuỳ chọn, để loại trừ hoàn toàn nghi vấn quyền) Vào `myaccount.google.com/permissions` bằng đúng tài khoản deploy, kiểm tra scope thực tế đã cấp cho project.

## 6. Lỗi thường gặp khi làm việc với Google Calendar Label API trong Apps Script

Danh sách này dành cho AI/dev khác gặp vấn đề tương tự trong tương lai:

| # | Lỗi | Triệu chứng | Cách nhận biết / phòng tránh |
|---|-----|-------------|-------------------------------|
| 1 | `id` của label không phải UUID | Label không lên, không crash | Luôn dùng `Utilities.getUuid()`, không tự chế id từ hex/string |
| 2 | Dùng `eventLabelVersion` cho `Calendars.get/patch` | Không lỗi, nhưng thừa — dễ gây hiểu lầm khi debug | Tham số này **chỉ cần cho Events** (insert/import/update/patch), không cần cho Calendars |
| 3 | `newEvent.getId()` có hậu tố `@google.com` | `Events.patch()` fail 404/400 khi patch qua Advanced Service | Luôn `.replace("@google.com", "")` trước khi dùng làm `eventId` cho Advanced Service |
| 4 | Scope OAuth không đủ (chỉ có `calendar.events`) | 403 khi patch `labelProperties`, catch nuốt mất | Cần `https://www.googleapis.com/auth/calendar` đầy đủ vì sửa label là thao tác cấp Calendar |
| 5 | Không có quyền `owner` trên calendar | Không tạo/sửa được label dù có quyền event | Theo doc: cần `owner` để định nghĩa/sửa `labelProperties`; chỉ cần `writerWithoutPrivateAccess` trở lên để **gán** label cho event |
| 6 | `try/catch` chỉ log `err.message`, không log `err.stack`/response body | Không biết lỗi thật là gì, chỉ thấy "đã bỏ qua" | Luôn log đầy đủ, dùng `console.error` thay vì `console.warn` cho lỗi cần điều tra |
| 7 | Tạo label và gán label cho event trong cùng 1 lần chạy, không có độ trễ | Đôi khi label mới tạo chưa kịp "nhìn thấy" ở lần gọi patch event ngay sau | Thêm `Utilities.sleep(300–500)` sau khi patch calendar, trước khi bắt đầu patch event |
| 8 | Không cache `hex → labelId` giữa các lần chạy | Tạo label trùng lặp mỗi lần sync, dễ chạm giới hạn | Google giới hạn tối đa 200 label/calendar — cache qua `PropertiesService` |
| 9 | Advanced Service (Apps Script) có thể lag phía sau Discovery doc mới của API vì feature vừa GA | Field mới (`labelProperties`, `eventLabelId`) có thể bị strip hoặc không nhận diện đúng dù code viết đúng theo doc | Nếu đã sửa hết #1–#8 mà vẫn fail không rõ lý do, chuyển sang gọi REST trực tiếp bằng `UrlFetchApp` + `ScriptApp.getOAuthToken()` (xem mục 7) để loại trừ hoàn toàn wrapper của Apps Script |
| 10 | Deploy code mới nhưng không tạo **New version** | Web App vẫn chạy code cũ dù editor đã lưu | Deploy → Manage deployments → Edit → New version → Deploy |

## 7. Kế hoạch dự phòng — bỏ qua Advanced Service, gọi REST trực tiếp

Nếu sau khi vá hết các lỗi trên mà log Executions **không báo lỗi gì** nhưng màu vẫn không lên, nghi vấn chuyển sang: Advanced Calendar Service của Apps Script (được sinh tự động từ Discovery document) có thể chưa cập nhật kịp field `labelProperties`/`eventLabelId` do feature quá mới. Giải pháp: thay `Calendar.Calendars.*` và `Calendar.Events.patch` bằng gọi REST thủ công qua `UrlFetchApp`, luôn dùng `muteHttpExceptions: true` và log `response.getContentText()` để thấy lỗi thật từ Google thay vì exception mơ hồ của wrapper.

```js
const token = ScriptApp.getOAuthToken();
const res = UrlFetchApp.fetch(
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
  {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ labelProperties: { eventLabels: newLabels } }),
    muteHttpExceptions: true
  }
);
if (res.getResponseCode() !== 200) {
  console.error('Update label thất bại: ' + res.getContentText());
}
```

Áp dụng tương tự cho `Events.patch` (`.../events/{eventId}?eventLabelVersion=1`).

## 8. Tài liệu tham khảo

- Labels guide (chính thức): `https://developers.google.com/workspace/calendar/api/guides/labels`
- Release note GA custom colors: `https://workspaceupdates.googleblog.com/2026/06/custom-event-colors-in-google-calendar.html`
- Cách Apps Script map optional params sang query string: `https://developers.google.com/apps-script/guides/services/advanced`
