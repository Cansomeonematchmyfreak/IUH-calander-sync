App script, lưu ý chọn triển khai là Ứng dụng web, Thực thi bằng tên: Tôi, Người có quyển truy cập: Bất kì ai.
Khi xong, người dùng sẽ thấy ở góc dưới bên trái web sinh viên là UI của extention, vui lòng truy cập chức năng chỉ khi vào https://sv.iuh.edu.vn/lich-theo-tuan.html (Lịch theo tuần)


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