(function () {
  console.log("[IUH] Content script loaded - Final Version");

  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxmP2L302KP5XTm3SMmZ8MNIjkzo4xXH7FD9Tk2SG-MC8LFCyw6hCrUILxQ8q3tb-pz0w/exec";

  const TIET_TIME = {
    1: "06:30", 2: "07:20", 3: "08:10", 4: "09:10",
    5: "10:00", 6: "10:50", 7: "12:30", 8: "13:20",
    9: "14:10", 10: "15:10", 11: "16:00", 12: "16:50",
    13: "18:00", 14: "18:50", 15: "19:50", 16: "20:40"
  };

  function parseDateVN(str) {
    const [d, m, y] = str.split("/");
    return `${y}-${m}-${d}`;
  }

  function hasSchedule() {
    return [...document.querySelectorAll("*")].some(el => el.innerText?.startsWith("Tiết:"));
  }

  function waitForSchedule(callback) {
    if (hasSchedule()) {
      callback();
      return;
    }
    const observer = new MutationObserver(() => {
      if (hasSchedule()) {
        observer.disconnect();
        callback();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function sync() {
    console.log("[IUH] Start parsing...");
    const table = document.querySelector("table");
    if (!table) return;

    const dateMap = {};
    table.querySelectorAll("thead th").forEach((th, i) => {
      const m = th.innerText.match(/\d{2}\/\d{2}\/\d{4}/);
      if (m) dateMap[i] = parseDateVN(m[0]);
    });

    const events = [];

    table.querySelectorAll("tbody tr").forEach(row => {
      row.querySelectorAll("td").forEach((cell, colIndex) => {
        if (!dateMap[colIndex]) return;
        if (!cell.innerText.includes("Tiết:")) return;

        // Tách các môn học trong cùng 1 ô (nếu có) dựa vào việc dòng "Tiết:" lặp lại
        // Tuy nhiên, cách split cũ có thể làm mất context phía trên.
        // Cách tốt nhất: Split cell thành các dòng, sau đó duyệt từng dòng để tìm cụm.
        
        const lines = cell.innerText.split("\n").map(l => l.trim()).filter(Boolean);
        
        // Thuật toán: Tìm vị trí các dòng chứa "Tiết:", từ đó suy ngược ra tên môn ở phía trên
        const tietIndices = [];
        lines.forEach((line, idx) => {
           if (line.includes("Tiết:")) tietIndices.push(idx);
        });

        tietIndices.forEach((tietIdx, i) => {
            // Xác định phạm vi của môn học hiện tại
            // Bắt đầu: từ sau dòng Tiết của môn trước đó (hoặc dòng 0)
            // Kết thúc: tại dòng Tiết hiện tại
            const startIdx = i === 0 ? 0 : tietIndices[i-1] + 1; // +1 để nhảy qua các dòng info của môn trước (Phòng, GV..) - tạm tính tương đối
            
            // Để an toàn, ta chỉ lấy các dòng nằm ngay trên dòng Tiết khoảng 3-4 dòng đổ lại
            // Vì cấu trúc là: Tên -> Mã Lớp -> Mã HP -> Tiết
            
            const currentTietLine = lines[tietIdx];
            
            // 1. Lấy thông tin Tiết
            const tietMatch = currentTietLine.match(/Tiết:\s*(\d+)\s*-\s*(\d+)/);
            if (!tietMatch) return;
            
            // 2. Tìm Phòng và GV (Nằm ngay sau dòng Tiết)
            // Quét từ dòng Tiết trở xuống cho đến khi gặp dòng Tiết tiếp theo hoặc hết cell
            let room = "Chưa cập nhật";
            const nextTietIdx = tietIndices[i+1] || lines.length;
            
            for (let j = tietIdx + 1; j < nextTietIdx; j++) {
                if (lines[j].startsWith("Phòng:")) {
                     room = lines[j].replace("Phòng:", "").trim();
                     break; 
                }
            }

            // 3. XỬ LÝ TÊN MÔN (QUAN TRỌNG NHẤT)
            // Lấy các dòng phía trên dòng Tiết
            const candidates = [];
            // Quét ngược từ dòng ngay trên "Tiết" lên trên
            for (let k = tietIdx - 1; k >= 0; k--) {
                const line = lines[k];
                // Nếu gặp dòng Tiết của môn trước hoặc gặp chữ "Phòng/GV" của môn trước thì dừng
                if (line.includes("Tiết:") || line.startsWith("Phòng:") || line.startsWith("GV:")) break;
                
                candidates.unshift(line); // Đẩy vào đầu mảng để giữ đúng thứ tự xuôi
            }

            // Lọc Candidates: Loại bỏ Mã lớp, Mã HP, Mã số lạ
            const subjectParts = candidates.filter(line => {
                const isClassCode = line.startsWith("DH") || line.includes(" - "); // DHHTTT...
                const isCourseCode = /^\d+$/.test(line); // 4203...
                return !isClassCode && !isCourseCode;
            });

            const subjectName = subjectParts.join(" ");

            if (!subjectName) return;

            const startTiet = Number(tietMatch[1]);
            const endTiet = Number(tietMatch[2]) + 1; // Kết thúc tiết là đầu giờ tiết sau

            if (TIET_TIME[startTiet] && TIET_TIME[endTiet]) {
                events.push({
                    subject: `[IUH] ${subjectName}`,
                    start: `${dateMap[colIndex]}T${TIET_TIME[startTiet]}:00+07:00`,
                    end: `${dateMap[colIndex]}T${TIET_TIME[endTiet]}:00+07:00`,
                    room: room
                });
            }
        });
      });
    });

    if (!events.length) {
      console.warn("[IUH] No events found");
      return;
    }

    console.table(events);

    fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(events)
    })
      .then(() => console.log("[IUH] Sync request sent!"))
      .catch(console.error);
  }

  waitForSchedule(sync);
})();