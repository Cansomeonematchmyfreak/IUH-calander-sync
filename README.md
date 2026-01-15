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


