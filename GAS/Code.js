function doPost(e) {
  if (!e || !e.postData) return ContentService.createTextOutput("No data");

  try {
    const data = JSON.parse(e.postData.contents);

    if (!data.weekStart || !data.weekEnd) {
      return ContentService.createTextOutput("ERROR: Missing range.");
    }

    const cal = CalendarApp.getDefaultCalendar();
    const calendarId = cal.getId();

    // Parse ngày boundary để dọn dẹp lịch cũ
    const deleteStart = new Date(data.weekStart + "T00:00:00+07:00");
    const deleteEnd = new Date(data.weekEnd + "T23:59:59+07:00");

    // 1. XOÁ SỰ KIỆN CŨ ĐỂ TRÁNH TRÙNG LẶP
    const oldEvents = cal.getEvents(deleteStart, deleteEnd);
    const eventsToDelete = oldEvents.filter(ev =>
      ev.getTitle().startsWith("[IUH]") || ev.getDescription().includes("IUH Calendar Sync")
    );
    eventsToDelete.forEach(ev => ev.deleteEvent());

    // 2. TẠO NHÃN MÀU (LABELS) CHO LỊCH ĐỂ HỖ TRỢ HEX TỰ DO
    const events = data.events || [];
    const uniqueColors = [...new Set(events.map(e => e.calendarColorHex))].filter(Boolean);

    if (uniqueColors.length > 0) {
      try {
        const calData = Calendar.Calendars.get(calendarId, { eventLabelVersion: 1 });
        const labelProps = calData.labelProperties || {};
        const existingLabels = labelProps.eventLabels || [];
        const newLabels = [...existingLabels];
        let labelsAdded = false;

        uniqueColors.forEach(hex => {
          if (!newLabels.some(l => l.backgroundColor === hex)) {
            newLabels.push({
              id: 'iuh_color_' + hex.replace('#', '').toLowerCase(),
              backgroundColor: hex,
              name: 'IUH Color ' + hex
            });
            labelsAdded = true;
          }
        });

        if (labelsAdded) {
          Calendar.Calendars.patch(
            { labelProperties: { eventLabels: newLabels } }, 
            calendarId, 
            { eventLabelVersion: 1 }
          );
        }
      } catch (labelErr) {
        console.warn("Lỗi tạo label màu (bỏ qua): " + labelErr.message);
      }
    }

    // 3. THÊM SỰ KIỆN MỚI
    events.forEach(ev => {
      try {
        let description = `GV: ${ev.teacher}`;

        if (ev.group) {
          description += `\n👥 NHÓM THI: ${ev.group}`;
        }

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

        // 🎨 GÁN NHÃN MÀU HEX BẰNG LABEL API (eventLabelVersion=1)
        if (ev.calendarColorHex) {
          try {
            const eventId = newEvent.getId().replace("@google.com", "");
            const labelId = 'iuh_color_' + ev.calendarColorHex.replace('#', '').toLowerCase();

            Calendar.Events.patch(
              {
                eventLabelId: labelId
              },
              calendarId,
              eventId,
              { eventLabelVersion: 1 }
            );
          } catch (colorErr) {
            console.warn("Không thể set màu cho: " + ev.subject + " | " + colorErr.message);
          }
        }

      } catch (innerErr) {
        console.error("Lỗi tạo event: " + ev.subject, innerErr);
      }
    });

    return ContentService.createTextOutput(`SYNC SUCCESS.\nDeleted: ${eventsToDelete.length}\nAdded: ${events.length}`);

  } catch (err) {
    return ContentService.createTextOutput("CRITICAL ERROR: " + err.toString());
  }
}
