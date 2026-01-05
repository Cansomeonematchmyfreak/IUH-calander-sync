(function () {
  console.log("[IUH] Content script loaded");

  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbxmP2L302KP5XTm3SMmZ8MNIjkzo4xXH7FD9Tk2SG-MC8LFCyw6hCrUILxQ8q3tb-pz0w/exec";

  // ⏰ Giờ bắt đầu các tiết (đã tính nghỉ 10p)
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

  // ===============================
  // 🔎 CHECK LỊCH ĐÃ XUẤT HIỆN CHƯA
  // ===============================
  function hasSchedule() {
    return [...document.querySelectorAll("*")]
      .some(el => el.innerText?.startsWith("Tiết:"));
  }

  // =================================
  // ⏳ ĐỢI DOM LOAD BẰNG OBSERVER
  // =================================
  function waitForSchedule(callback) {
    console.log("[IUH] Waiting for schedule…");

    if (hasSchedule()) {
      console.log("[IUH] Schedule already available");
      callback();
      return;
    }

    const observer = new MutationObserver(() => {
      if (hasSchedule()) {
        observer.disconnect();
        console.log("[IUH] Schedule detected");
        callback();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ===============================
  // 🧠 PARSE + SYNC
  // ===============================
  function sync() {
  console.log("[IUH] Start parsing (table-based, multi-subject)");

  const table = document.querySelector("table");
  if (!table) {
    console.warn("[IUH] Không tìm thấy table lịch học");
    return;
  }

  // 📅 Map cột → ngày
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

      // 🔥 ĐOẠN FIX NHIỀU MÔN TRONG 1 Ô
      const blocks = cell.innerText.split(/(?=Tiết:\s*\d+)/);

      blocks.forEach(block => {
        if (!block.includes("Tiết:")) return;

        const lines = block
          .split("\n")
          .map(l => l.trim())
          .filter(Boolean);

        const subject = lines.find(
          l =>
            l.length > 5 &&
            !l.startsWith("DH") &&
            !l.startsWith("Tiết:")
        );

        const tietMatch = block.match(/Tiết:\s*(\d+)\s*-\s*(\d+)/);
        const roomMatch = block.match(/Phòng:\s*(.+)/);

        if (!subject || !tietMatch) return;

        const startTiet = Number(tietMatch[1]);
        const endTiet = Number(tietMatch[2]) + 1;

        if (!TIET_TIME[startTiet] || !TIET_TIME[endTiet]) return;

        events.push({
          subject: `[IUH] ${subject}`,
          start: `${dateMap[colIndex]}T${TIET_TIME[startTiet]}:00`,
          end: `${dateMap[colIndex]}T${TIET_TIME[endTiet]}:00`,
          room: roomMatch ? roomMatch[1] : ""
        });
      });
    });
  });

  if (!events.length) {
    console.warn("[IUH] Parse xong nhưng không có event");
    return;
  }

  console.table(events);

  fetch(WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify(events)
  })
    .then(r => r.text())
    .then(t => console.log("[IUH] Sync OK:", t))
    .catch(console.error);
}


  // 🚀 START
  waitForSchedule(sync);
})();
