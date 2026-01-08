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
    
    // Parse ngày bắt đầu của tuần đầu tiên và ngày kết thúc của tuần cuối cùng
    const deleteStart = new Date(data.weekStart + "T00:00:00+07:00");
    const deleteEnd = new Date(data.weekEnd + "T23:59:59+07:00");

    // 1. XOÁ SỰ KIỆN CŨ (Batch Delete - Nhanh hơn)
    // Lấy tất cả sự kiện trong khoảng thời gian lớn (ví dụ 10 tuần)
    const oldEvents = cal.getEvents(deleteStart, deleteEnd);
    
    // Lọc sự kiện của IUH
    const eventsToDelete = oldEvents.filter(ev => 
      ev.getTitle().startsWith("[IUH]") || ev.getDescription().includes("IUH Calendar Sync")
    );

    // Xoá (Google Calendar API không có batch delete native trong Apps Script thuần, 
    // nhưng ta xoá mảng đã lọc sẽ nhanh hơn check từng cái)
    eventsToDelete.forEach(ev => ev.deleteEvent());

    // 2. THÊM SỰ KIỆN MỚI
    // ... (Phần xoá lịch cũ giữ nguyên) ...

    // 2. THÊM SỰ KIỆN MỚI
    const events = data.events || [];
    
    // Map màu sắc (Cập nhật màu Peacock và Yellow)
    const colorMap = {
      "thuc-hanh": CalendarApp.EventColor.SAGE,   // Xanh lá cây (Thực hành)
      "thi": CalendarApp.EventColor.BANANA,        // Vàng (Lịch thi)
      "truc-tuyen": CalendarApp.EventColor.CYAN,   // Xanh lơ/Peacock (Online Zoom/Teams)
      "ly-thuyet": CalendarApp.EventColor.GRAPHITE // Xám (Lý thuyết)
    }; 

    events.forEach(ev => {
      try {
        // Xây dựng mô tả chi tiết
        let description = `GV: ${ev.teacher}`;
        
        // Nếu có ghi chú (Code Zoom/Teams), thêm vào mô tả cho nổi bật
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
        
        // Set màu
        const color = colorMap[ev.type] || CalendarApp.EventColor.BLUE;
        newEvent.setColor(color);

      } catch (innerErr) {
        console.error("Lỗi tạo event: " + ev.subject, innerErr);
      }
    });
    
    // ... (Phần return kết quả giữ nguyên) ...

    return ContentService.createTextOutput(`SYNC SUCCESS.\nRange: ${data.weekStart} -> ${data.weekEnd}\nDeleted: ${eventsToDelete.length}\nAdded: ${events.length}`);

  } catch (err) {
    return ContentService.createTextOutput("CRITICAL ERROR: " + err.toString());
  }
}
