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

    // Map hex -> labelId, dùng chung cho cả bước tạo label lẫn bước gán màu cho event bên dưới
    const hexToLabelId = {};

    if (uniqueColors.length > 0) {
      try {
        const scriptProps = PropertiesService.getScriptProperties();
        // Cache map hex -> UUID label đã tạo ở những lần sync trước, tránh tạo trùng label
        // (Google giới hạn tối đa 200 label/calendar, và mỗi lần tạo lại tốn 1 API call)
        const cachedMap = JSON.parse(scriptProps.getProperty('IUH_HEX_LABEL_MAP') || '{}');

        const calData = Calendar.Calendars.get(calendarId);
        const labelProps = calData.labelProperties || {};
        const existingLabels = labelProps.eventLabels || [];
        const newLabels = [...existingLabels];
        let labelsAdded = false;

        // Nạp lại các label đã biết từ calendar thật (nguồn đáng tin cậy nhất)
        existingLabels.forEach(l => {
          const key = (l.backgroundColor || '').toLowerCase();
          if (key) hexToLabelId[key] = l.id;
        });

        uniqueColors.forEach(hex => {
          const key = hex.toLowerCase();
          if (hexToLabelId[key]) return; // đã tồn tại trên calendar rồi, khỏi tạo lại

          // ID PHẢI là UUID hợp lệ — Google Calendar Label API từ chối id dạng chuỗi tuỳ ý
          // (id kiểu "iuh_color_616161" trước đây rất có thể đã bị API trả lỗi 400 âm thầm)
          const id = cachedMap[key] || Utilities.getUuid();
          newLabels.push({
            id: id,
            backgroundColor: hex,
            name: 'IUH Color ' + hex
          });
          hexToLabelId[key] = id;
          cachedMap[key] = id;
          labelsAdded = true;
        });

        if (labelsAdded) {
          Calendar.Calendars.patch(
            { labelProperties: { eventLabels: newLabels } },
            calendarId
          );
          scriptProps.setProperty('IUH_HEX_LABEL_MAP', JSON.stringify(cachedMap));
          // Đệm nhỏ để tránh trường hợp label vừa tạo chưa kịp propagate
          // trước khi Events.patch() bên dưới cố gán eventLabelId cho event
          Utilities.sleep(500);
        }
      } catch (labelErr) {
        console.error("Lỗi tạo label màu: " + labelErr.message + "\n" + (labelErr.stack || ""));
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
          const labelId = hexToLabelId[ev.calendarColorHex.toLowerCase()];
          if (!labelId) {
            console.error("Không tìm thấy labelId cho màu " + ev.calendarColorHex + " (bước tạo label ở trên có thể đã fail)");
          } else {
            try {
              const eventId = newEvent.getId().replace("@google.com", "");

              Calendar.Events.patch(
                { eventLabelId: labelId },
                calendarId,
                eventId,
                { eventLabelVersion: 1 }
              );
            } catch (colorErr) {
              console.error("Không thể set màu cho: " + ev.subject + " | " + colorErr.message + "\n" + (colorErr.stack || ""));
            }
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
