function doPost(e) {
  if (!e || !e.postData) return ContentService.createTextOutput("No data");

  try {
    const data = JSON.parse(e.postData.contents);
    
    if (!data.weekStart || !data.weekEnd) {
      return ContentService.createTextOutput("ERROR: Missing range.");
    }

    const cal = CalendarApp.getDefaultCalendar();
    
    // Parse ngày boundary để dọn dẹp lịch cũ
    const deleteStart = new Date(data.weekStart + "T00:00:00+07:00");
    const deleteEnd = new Date(data.weekEnd + "T23:59:59+07:00");

    // 1. XOÁ SỰ KIỆN CŨ ĐỂ TRÁNH TRÙNG LẶP
    const oldEvents = cal.getEvents(deleteStart, deleteEnd);
    const eventsToDelete = oldEvents.filter(ev => 
      ev.getTitle().startsWith("[IUH]") || ev.getDescription().includes("IUH Calendar Sync")
    );
    eventsToDelete.forEach(ev => ev.deleteEvent());

    // 2. THÊM SỰ KIỆN MỚI
    const events = data.events || [];
    
    // Bảng ánh xạ từ ID Số (Chuỗi) mà Extension gửi lên sang Enum của Google Apps Script
    const colorEnumMap = {
      "1": CalendarApp.EventColor.PALE_BLUE,   // Lavender (Tím nhạt)
      "2": CalendarApp.EventColor.PALE_GREEN,  // Sage (Xanh lá nhạt)
      "3": CalendarApp.EventColor.MAUVE,       // Grape (Tím đậm)
      "4": CalendarApp.EventColor.PALE_RED,    // Flamingo (Hồng)
      "5": CalendarApp.EventColor.YELLOW,      // Banana (Vàng)
      "6": CalendarApp.EventColor.ORANGE,      // Tangerine (Cam)
      "7": CalendarApp.EventColor.CYAN,        // Peacock (Xanh lơ)
      "8": CalendarApp.EventColor.GRAY,        // Graphite (Xám)
      "9": CalendarApp.EventColor.BLUE,        // Blueberry (Xanh dương)
      "10": CalendarApp.EventColor.GREEN,      // Basil (Xanh lá đậm)
      "11": CalendarApp.EventColor.RED         // Tomato (Đỏ)
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

        // Tiến hành tạo sự kiện trên Google Calendar
        const newEvent = cal.createEvent(
          ev.subject,
          new Date(ev.start),
          new Date(ev.end),
          {
            location: ev.room,
            description: description
          }
        );
        
        // 🎨 XỬ LÝ GÁN MÀU TỰ ĐỘNG KHỚP THEO CONFIG CỦA CLIENT
        let eventColor = CalendarApp.EventColor.PALE_BLUE; // Màu mặc định ban đầu nếu không khớp

        if (ev.calendarColorId && colorEnumMap[ev.calendarColorId]) {
          eventColor = colorEnumMap[ev.calendarColorId];
        } 

        // Gán màu cho sự kiện vừa tạo
        newEvent.setColor(eventColor);

      } catch (innerErr) {
        console.error("Lỗi tạo event: " + ev.subject, innerErr);
      }
    });

    return ContentService.createTextOutput(`SYNC SUCCESS.\nDeleted: ${eventsToDelete.length}\nAdded: ${events.length}`);

  } catch (err) {
    return ContentService.createTextOutput("CRITICAL ERROR: " + err.toString());
  }
}