# 🔄 IUH Calendar Sync AI (v2.0)

## 📌 Giới thiệu
**IUH Calendar Sync AI** là một tiện ích mở rộng (*Chrome Extension*) kết hợp với **Google Apps Script** giúp sinh viên trường Đại học Công nghiệp TP.HCM (IUH) tự động quét và đồng bộ lịch học, lịch thi từ website trường (`sv.iuh.edu.vn`) sang **Google Calendar** chỉ trong một cú click chuột hoặc hoàn toàn chạy ngầm định kỳ.

Dự án tích hợp mô hình học máy (*Machine Learning*) giải mã Captcha chạy trực tiếp tại Client, giải quyết triệt để bài toán tự động hóa quy trình đăng nhập mà không phụ thuộc vào bên thứ ba.

---

## ✨ Tính năng nổi bật

* 🤖 **AI Captcha Solver:** Tích hợp mô hình trí tuệ nhân tạo (*TensorFlow.js*) tự động nhận diện và bẻ khóa mã Captcha trường (bao gồm cả chữ cái và số) với độ chính xác cao.
* ⚡ **Tự động hóa hoàn toàn (Auto-Login):** Tùy chọn tự động điền thông tin tài khoản MSSV / Mật khẩu và kích hoạt nút đăng nhập ngay sau khi AI giải xong Captcha.
* 🎨 **Bảng màu Độc quyền & Thông minh (Auto-Swap UX):**
    * Đồng bộ chuẩn **11 mã màu** của hệ thống Google Calendar API công khai.
    * Tự động thay đổi màu sắc hiển thị ngoài Dashboard theo thời gian thực (*Real-time*).
    * Thuật toán **Hoán đổi màu tự động (Auto-Swap)**: Khi chọn một màu đã bị lớp học khác chiếm dụng, hệ thống tự động đổi chỗ 2 màu cho nhau, loại bỏ hoàn toàn cảm giác khó chịu khi cấu hình.
* 🤖 **Đồng bộ ngầm định kỳ (Silent Sync Mode):** Tự động bẻ lái điều hướng, cào dữ liệu lịch của 5 tuần học tiếp theo hoàn toàn ẩn danh dưới nền và tự động đóng tab trình duyệt khi hoàn tất.
* 🛡️ **An toàn & Trực quan:** Chức năng ẩn/hiện mật khẩu ngay trên giao diện cấu hình mướt rượt, giao diện Dashboard bo tròn hiện đại sử dụng các công tắc trượt dạng *Switch Slider*.

---

## 🧩 Kiến trúc hoạt động (Workflow)
``` text
[Website Lịch Trường IUH] 
          │
          ▼
[Chrome Extension - Thu thập dữ liệu và Giải mã AI]
          │
          ▼
[Gửi yêu cầu POST JSON qua mạng]
          │
          ▼
[Google Apps Script WebApp xử lý logic xóa/tạo]
          │
          ▼
[API Ghi dữ liệu lên Google Calendar của Sinh viên]
```

---

## 🛠️ Hướng dẫn Cài đặt & Triển khai

### 1️⃣ Triển khai Google Apps Script (Phía Server)
Để lưu trữ và gán màu lịch học lên tài khoản Google của bạn, hãy tạo một cổng kết nối API:

1. Truy cập vào **Google Apps Script** và tạo một dự án mới.
2. Tạo file script và dán toàn bộ mã nguồn xử lý sự kiện từ file `/gas/Code.js` trong thư mục dự án này vào.
3. Bấm vào nút **Deploy (Triển khai)** ở góc trên cùng bên phải `-->` Chọn **New deployment (Triển khai mới)**.
4. Chọn loại cấu hình là **Web app (Ứng dụng web)**:
    * *Execute as (Thực thi dưới danh nghĩa):* **Me (Tôi)**
    * *Who has access (Người có quyền truy cập):* **Anyone (Bất kỳ ai)**
5. Bấm **Deploy**, tiến hành cấp quyền truy cập lịch nếu Google yêu cầu, sau đó sao chép lại đoạn **Web App URL** được cấp.

> ⚠️ **Lưu ý cực kỳ quan trọng:** Mỗi lần bạn chỉnh sửa mã nguồn trên Google Apps Script, bạn bắt buộc phải chọn **Manage Deployments (Quản lý bản triển khai)** `-->` Bấm biểu tượng **Cây bút** `-->` Chọn **New Version (Phiên bản mới)** thì code mới thực sự có hiệu lực đằng sau Web App.

---

### 2️⃣ Cài đặt Chrome Extension (Phía Client)
1. Tải toàn bộ mã nguồn của dự án này về máy tính của bạn và giải nén.
2. Mở trình duyệt Google Chrome (hoặc Edge, Brave, Opera...) và truy cập đường dẫn: `chrome://extensions/`.
3. Bật công tắc **Developer mode (Chế độ nhà phát triển)** ở góc trên bên phải giao diện.
4. Bấm vào nút **Load unpacked (Tải tiện ích đã giải nén)** ở góc trái và trỏ tới thư mục chứa mã nguồn Extension của bạn.

---

### 3️⃣ Cấu hình Dashboard để chạy ứng dụng
1. Click vào biểu tượng Extension IUH trên thanh công cụ của trình duyệt để mở **Bảng điều khiển (Dashboard)**.
2. Tiến hành cấu hình các thông số:
    * Dán link **Google Apps Script WebApp URL** đã copy ở Bước 1 vào ô API.
    * Nhập tài khoản **MSSV** và **Mật khẩu** sinh viên của bạn vào ô tương ứng.
    * Bật/Tắt các nút gạt tự động điền thông tin, tự động giải Captcha bằng AI theo nhu cầu sử dụng.
    * Lựa chọn màu sắc phân loại (Lý thuyết, Thực hành, Trực tuyến, Lịch thi, Lịch hoãn) bằng các ô chọn trực quan.
3. Bấm nút **LƯU TOÀN BỘ CẤU HÌNH** để hệ thống đồng bộ ghi nhận dữ liệu vào bộ nhớ của Chrome.

---

## 📅 Phân loại màu sắc mặc định (Mốc ban đầu)

Khi khởi tạo hoặc chưa có cấu hình riêng, hệ thống tự động gán các màu sắc đặc trưng bao gồm:

* 🔘 **Môn Lý thuyết:** Màu *Graphite (Xám)*
* 🌿 **Môn Thực hành:** Màu *Sage (Xanh lá nhạt)*
* 🔵 **Môn Trực tuyến:** Màu *Blueberry (Xanh dương)*
* 🟡 **Lịch Thi:** Màu *Banana (Vàng)*
* 🔴 **Tạm ngưng / Hoãn:** Màu *Tomato (Đỏ)*

---

## 📂 Cấu trúc thư mục dự án

```text
├── manifest.json            # File khai báo quyền và cấu hình Chrome Extension
├── options.html             # Giao diện Dashboard cấu hình Extension
├── options.js               # Logic xử lý giao diện Dashboard & Hoán đổi màu sắc thông minh
├── content.js               # Content Script nhúng vào web trường để cào lịch và chạy AI giải mã
├── bridge.js                # Cầu nối trung gian luân chuyển dữ liệu giữa Main World và Extension Storage
├── background.js            # Xử lý các tiến trình ngầm, vòng lặp trigger thời gian định kỳ
├── tfjs_model/              # Thư mục chứa cấu trúc mạng nơ-ron và trọng số của mô hình AI giải Captcha
└── gas/
    └── Code.js              # Mã nguồn xử lý API nhận dữ liệu và gán màu trên Google Apps Script
```

📌 Disclaimer (Miễn trừ trách nhiệm)
Dự án này được phát triển hoàn toàn vì mục đích học tập, nghiên cứu ứng dụng công nghệ học máy (TensorFlow.js) chạy trên Client và hỗ trợ nâng cao trải nghiệm cá nhân, quản lý thời gian hiệu quả cho sinh viên IUH. Tác giả hoàn toàn không chịu bất kỳ trách nhiệm nào liên quan đến việc sử dụng công cụ này sai mục đích hoặc vi phạm các quy chế hệ thống thông tin của nhà trường.