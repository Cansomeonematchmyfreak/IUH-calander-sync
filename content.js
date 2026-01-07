(function () {
  console.log("[IUH] Content script loaded - Fixed Overlap Version");

  // --- CẤU HÌNH ---
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwNfS00wZ54cUXKhoIOtEi-oRStegXW50eSRb5j9zkrhmJAkooHwE8AfI_tMzd03wtBmA/exec"; // <--- Nhớ điền URL của bạn vào đây
  const TIET_TIME = {
    1: "06:30", 2: "07:20", 3: "08:10", 4: "09:10",
    5: "10:00", 6: "10:50", 7: "12:30", 8: "13:20",
    9: "14:10", 10: "15:10", 11: "16:00", 12: "16:50",
    13: "18:00", 14: "18:50", 15: "19:50", 16: "20:40"
  };

  function sync() {
    const table = document.querySelector("table");
    if (!table) {
      alert("Không tìm thấy bảng lịch học!");
      return;
    }

    // 1. XÁC ĐỊNH PHẠM VI TUẦN (Để gửi lên Server xóa lịch cũ)
    const allDates = [];
    const dateMap = {}; // Map colIndex -> Date String (yyyy-mm-dd)

    table.querySelectorAll("thead th").forEach((th, i) => {
      // Regex bắt ngày dd/mm/yyyy
      const m = th.innerText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) {
        // Chuyển thành yyyy-mm-dd để sort và gửi đi
        const isoDate = `${m[3]}-${m[2]}-${m[1]}`;
        dateMap[i] = isoDate;
        allDates.push(isoDate);
      }
    });

    if (allDates.length === 0) {
      alert("Không xác định được ngày tháng trên bảng!");
      return;
    }

    // Sắp xếp để lấy ngày đầu và ngày cuối chính xác
    allDates.sort();
    const weekStart = allDates[0]; 
    const weekEnd = allDates[allDates.length - 1];

    // 2. QUÉT DỮ LIỆU SỰ KIỆN (Giữ nguyên logic tách dòng thông minh)
    const events = [];
    table.querySelectorAll("tbody tr td").forEach((cell, colIndex) => {
      const date = dateMap[cell.cellIndex];
      if (!date || !cell.innerText.includes("Tiết:")) return;

      const lines = cell.innerText.split("\n").map(l => l.trim()).filter(Boolean);
      
      // Tìm vị trí các dòng chứa "Tiết:"
      const tietIndices = lines.reduce((acc, line, idx) => {
        if (line.includes("Tiết:")) acc.push(idx);
        return acc;
      }, []);

      tietIndices.forEach((tietIdx, i) => {
        const nextTietIdx = tietIndices[i + 1] || lines.length;
        const prevTietIdx = i === 0 ? -1 : tietIndices[i - 1];

        const tietMatch = lines[tietIdx].match(/Tiết:\s*(\d+)\s*-\s*(\d+)/);
        if (!tietMatch) return;

        // Tìm Phòng & GV
        let room = "Chưa cập nhật";
        let teacher = "Chưa cập nhật";
        
        for (let j = tietIdx + 1; j < nextTietIdx; j++) {
          if (lines[j].startsWith("Phòng:")) room = lines[j].replace("Phòng:", "").trim();
          // Cập nhật Regex tìm GV linh hoạt hơn
          if (lines[j].match(/^(GV|Giảng viên):/i)) {
             teacher = lines[j].replace(/^(GV|Giảng viên):/i, "").trim();
          }
        }

        // Tìm Tên môn (Quét ngược lên)
        let subjectParts = [];
        for (let k = tietIdx - 1; k > prevTietIdx; k--) {
          const line = lines[k];
          // Loại bỏ Mã HP (số), Mã Lớp (DH..), Mã nhóm (tổ..)
          if (!/^\d+$/.test(line) && !line.startsWith("DH") && !line.includes(" - ")) {
            subjectParts.unshift(line);
          }
        }
        const subjectName = subjectParts.join(" ");

        // Xác định loại (Màu sắc)
        let type = "ly-thuyet";
        const bg = window.getComputedStyle(cell).backgroundColor; // Check màu nền ô
        const divBg = cell.querySelector("div") ? window.getComputedStyle(cell.querySelector("div")).backgroundColor : "";
        
        if (bg.includes("144, 238, 144") || divBg.includes("144, 238, 144")) type = "thuc-hanh"; // Xanh lá
        if (bg.includes("255, 255, 0") || divBg.includes("255, 255, 0")) type = "thi"; // Vàng

        events.push({
          subject: `[IUH] ${subjectName}`,
          start: `${date}T${TIET_TIME[tietMatch[1]]}:00+07:00`,
          end: `${date}T${TIET_TIME[Number(tietMatch[2]) + 1]}:00+07:00`, // Kết thúc tiết là đầu giờ tiết sau
          room: room,
          teacher: teacher,
          type: type
        });
      });
    });

    console.log(`[IUH] Found ${events.length} events from ${weekStart} to ${weekEnd}`);

    // 3. GỬI DỮ LIỆU (Bao gồm cả range tuần)
    const payload = {
      weekStart: weekStart,
      weekEnd: weekEnd,
      events: events
    };

    fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    .then(() => {
        alert(`Đã gửi yêu cầu đồng bộ!\nTuần: ${weekStart} đến ${weekEnd}\nSố môn: ${events.length}`);
    })
    .catch(err => alert("Lỗi gửi dữ liệu: " + err));
  }

  // Chờ nút sync hoặc chạy tự động (tuỳ bạn setup)
  // Ở đây mình chạy sau 3s để đảm bảo trang load xong
  setTimeout(sync, 3000);

})();