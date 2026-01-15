# IUH Calendar Sync

## 📌 Giới thiệu
**IUH Calendar Sync** là một project giúp sinh viên IUH **xem và đồng bộ lịch học lên Google Calendar**, đặc biệt hữu ích khi:
- Website sinh viên không truy cập được
- Người dùng “lười” lên web trường để xem lịch 😛

Project kết hợp **Chrome Extension** và **Google Apps Script** để lấy dữ liệu lịch học từ hệ thống IUH và tự động đẩy lên Google Calendar, giúp theo dõi lịch học thuận tiện trên mọi thiết bị.

---

## ✨ Tính năng
- Đồng bộ **lịch học theo tuần** từ IUH
- Tự động **xoá lịch cũ và thêm lịch mới** để tránh trùng lặp
- Lịch học được **color-coded** giống với web IUH:
  - 🟢 Thực hành
  - ⚪ Lý thuyết
  - 🟡 Thi
  - 🔵 Trực tuyến
  - 🔴 Tạm ngưng
- Nội dung sự kiện bao gồm:
  - Tên môn học
  - Giảng viên
  - Phòng học
  - Nhóm thi (nếu có)
  - Ghi chú / Zoom code (nếu có)

---
## 🧩 Kiến trúc hoạt động (Workflow)
IUH Website (Lịch theo tuần)
↓
Chrome Extension (Lấy dữ liệu)
↓
Google Apps Script (Web App)
↓
Google Calendar


---

## 🛠 Cài đặt & Triển khai

### 1️⃣ Google Apps Script (xem code ở cuối trang)
1. Tạo một project mới tại **Google Apps Script**
2. Dán code xử lý `doPost(e)` vào project
3. Chọn **Deploy → Ứng dụng web**
   - Thực thi bằng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
4. Sau khi triển khai, lưu lại **Web App URL**

> URL này sẽ được Chrome Extension dùng để gửi dữ liệu lịch học.

---

### 2️⃣ Chrome Extension
- Load extension ở chế độ **Developer mode**
- Extension **chỉ hoạt động khi truy cập**: https://sv.iuh.edu.vn/lich-theo-tuan.html

- - Khi vào trang **Lịch theo tuần**, UI của extension sẽ xuất hiện ở  
👉 **góc dưới bên phải** màn hình


---

## 🎨 Bảng màu lịch học

| Loại lịch     | Màu hiển thị |
|--------------|--------------|
| Thực hành    | Xanh lá      |
| Lý thuyết    | Xám          |
| Thi          | Vàng         |
| Trực tuyến   | Xanh lơ      |
| Tạm ngưng    | Đỏ           |

---

## ⚠️ Hạn chế
- Chỉ hỗ trợ **đồng bộ theo từng tuần**
- Phụ thuộc vào cấu trúc HTML của website IUH  
  (có thể bị lỗi nếu IUH thay đổi giao diện)
- Chỉ đồng bộ vào **Google Calendar mặc định**

---

## 📄 Disclaimer
Project được thực hiện với mục đích **học tập và sử dụng cá nhân**,  
không phải sản phẩm chính thức của Trường Đại học Công nghiệp TP.HCM (IUH).


## 🧩 Kiến trúc hoạt động (Workflow)
IUH Website (Lịch theo tuần)
↓
Chrome Extension (Lấy dữ liệu)
↓
Google Apps Script (Web App)
↓
Google Calendar


---

## 🛠 Cài đặt & Triển khai

### 1️⃣ Google Apps Script
1. Tạo một project mới tại **Google Apps Script**
2. Dán code xử lý `doPost(e)` vào project
3. Chọn **Deploy → Ứng dụng web**
   - Thực thi bằng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
4. Sau khi triển khai, lưu lại **Web App URL**

> URL này sẽ được Chrome Extension dùng để gửi dữ liệu lịch học.

---

### 2️⃣ Chrome Extension
- Load extension ở chế độ **Developer mode**
- Extension **chỉ hoạt động khi truy cập**: https://sv.iuh.edu.vn/lich-theo-tuan.html
- Khi vào trang **Lịch theo tuần**, UI của extension sẽ xuất hiện ở  **góc dưới bên phải** màn hình

---

## 🎨 Bảng màu lịch học

| Loại lịch     | Màu hiển thị |
|--------------|--------------|
| Thực hành    | Xanh lá      |
| Lý thuyết    | Xám          |
| Thi          | Vàng         |
| Trực tuyến   | Xanh lơ      |
| Tạm ngưng    | Đỏ           |

---

## ⚠️ Hạn chế
- Chỉ hỗ trợ **đồng bộ theo từng tuần**
- Phụ thuộc vào cấu trúc HTML của website IUH  
  (có thể bị lỗi nếu IUH thay đổi giao diện)
- Chỉ đồng bộ vào **Google Calendar mặc định**

---

## 📄 Disclaimer
Project được thực hiện với mục đích **học tập và sử dụng cá nhân**,  
không phải sản phẩm chính thức của Trường Đại học Công nghiệp TP.HCM (IUH).


---

## 📜 Google Apps Script Code:

function doPost(e) {
  if (!e || !e.postData) return ContentService.createTextOutput("No data");

  try {
    const data = JSON.parse(e.postData.contents);
    
    if (!data.weekStart || !data.weekEnd) {
      return ContentService.createTextOutput("ERROR: Missing range.");
    }

    const cal = CalendarApp.getDefaultCalendar();
    
    // Parse ngày
    const deleteStart = new Date(data.weekStart + "T00:00:00+07:00");
    const deleteEnd = new Date(data.weekEnd + "T23:59:59+07:00");

    // 1. XOÁ SỰ KIỆN CŨ
    const oldEvents = cal.getEvents(deleteStart, deleteEnd);
    const eventsToDelete = oldEvents.filter(ev => 
      ev.getTitle().startsWith("[IUH]") || ev.getDescription().includes("IUH Calendar Sync")
    );
    eventsToDelete.forEach(ev => ev.deleteEvent());

    // 2. THÊM SỰ KIỆN MỚI
    const events = data.events || [];
    
    // --- BẢNG MÀU CHUẨN (ĐÃ FIX LỖI BANANA) ---
    const colorMap = {
      "thuc-hanh": CalendarApp.EventColor.GREEN,    // Xanh lá
      "thi": CalendarApp.EventColor.YELLOW,         // Vàng (Thay cho Banana)
      "truc-tuyen": CalendarApp.EventColor.CYAN,    // Xanh lơ (Thay cho Peacock)
      "ly-thuyet": CalendarApp.EventColor.GRAY,     // Xám (Graphite)
      "tam-ngung": CalendarApp.EventColor.RED       // Đỏ (Tomato)
    }; 

    events.forEach(ev => {
      try {
        let description = `GV: ${ev.teacher}`;
        
        // Hiển thị Nhóm thi
        if (ev.group) {
           description += `\n👥 NHÓM THI: ${ev.group}`;
        }

        // Hiển thị Ghi chú / Pass Zoom
        if (ev.note) {
          description += `\n\n📌 GHI CHÚ / CODE:\n${ev.note}`;
        }
        
        description += `\n\n---\nIUH Calendar Sync`;

        const newEvent = cal.createEvent(
          ev.subject,
          new Date(ev.start),
          new Date(ev.end),
          {
            location: ev.room,
            description: description
          }
        );
        
        // Set màu an toàn (Mặc định là Pale Blue nếu không khớp)
        const color = colorMap[ev.type] || CalendarApp.EventColor.PALE_BLUE;
        newEvent.setColor(color);

      } catch (innerErr) {
        console.error("Lỗi tạo event: " + ev.subject, innerErr);
      }
    });

    return ContentService.createTextOutput(`SYNC SUCCESS.\nDeleted: ${eventsToDelete.length}\nAdded: ${events.length}`);

  } catch (err) {
    return ContentService.createTextOutput("CRITICAL ERROR: " + err.toString());
  }
}

