(function () {
  console.log("[IUH Sync] Script Loaded - Multi-week Version");

  // --- CẤU HÌNH ---
  const CONFIG = {
    // URL Apps Script của bạn
    API_URL: "https://script.google.com/macros/s/AKfycbz5CWhHpvwWeVmhblW5c9dtu7-uGjkTTkM7OkFQ2eiHeZhZ809jFIxYmlrtTmBSYE9bAw/exec",
    TIET_TIME: {
      1: "06:30", 2: "07:20", 3: "08:10", 4: "09:10", 5: "10:00", 6: "10:50",
      7: "12:30", 8: "13:20", 9: "14:10", 10: "15:10", 11: "16:00", 12: "16:50",
      13: "18:00", 14: "18:50", 15: "19:50", 16: "20:40"
    }
  };

  // --- UI: TẠO NÚT BẤM TRÊN MÀN HÌNH ---
  function createSyncButton() {
    const btn = document.createElement("button");
    btn.innerText = "📅 Đồng bộ Lịch sang Google";
    btn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      padding: 12px 20px; background: #0f9d58; color: white; border: none;
      border-radius: 50px; font-weight: bold; cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2); font-family: sans-serif;
    `;
    btn.onclick = startSyncProcess;
    document.body.appendChild(btn);
  }

  // --- LOGIC: CHỜ DOM CẬP NHẬT ---
  function waitForNextWeekLoad(oldDateValue) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const newDateValue = document.getElementById("firstDateOffWeek")?.value;
        // Nếu giá trị ngày đầu tuần đã thay đổi so với cũ -> Trang đã load xong
        if (newDateValue && newDateValue !== oldDateValue) {
          clearInterval(checkInterval);
          // Chờ thêm 500ms để DOM render hết các div class="content"
          setTimeout(resolve, 500); 
        }
      }, 100); // Check mỗi 100ms
    });
  }

  // --- LOGIC: QUÉT DỮ LIỆU CỦA 1 TUẦN (Đã cập nhật tính năng lấy Ghi chú & Lịch Online) ---
function scrapeCurrentWeek() {
  const table = document.querySelector("table.fl-table");
  if (!table) return [];

  // 1. Map ngày tháng
  const dateMap = {};
  table.querySelectorAll("thead th").forEach((th, index) => {
    const match = th.innerText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) dateMap[index] = `${match[3]}-${match[2]}-${match[1]}`;
  });

  const events = [];

  // 2. Quét từng ô
  table.querySelectorAll("tbody tr td").forEach((cell) => {
    const date = dateMap[cell.cellIndex];
    if (!date) return;

    cell.querySelectorAll(".content").forEach(div => {
      const text = div.innerText; 
      
      // -- PARSE CƠ BẢN --
      const subjectEl = div.querySelector("a");
      const subjectName = subjectEl ? subjectEl.innerText.trim() : "Môn học không tên";

      const tietMatch = text.match(/Tiết:\s*(\d+)\s*-\s*(\d+)/);
      if (!tietMatch) return;
      
      const startTiet = parseInt(tietMatch[1]);
      const endTiet = parseInt(tietMatch[2]);

      // Lấy Phòng học
      let room = "Chưa cập nhật";
      const roomMatch = text.match(/Phòng:\s*(.+?)(\n|$)/);
      if (roomMatch) room = roomMatch[1].trim();

      // Lấy Giảng viên
      let teacher = "Chưa cập nhật";
      const teacherMatch = text.match(/GV:\s*(.+?)(\n|$)/);
      if (teacherMatch) teacher = teacherMatch[1].trim();

      // -- TÍNH NĂNG MỚI: LẤY GHI CHÚ (ZOOM/TEAMS CODE) --
      // Tìm dòng bắt đầu bằng "Ghi chú:" và lấy hết nội dung sau đó
      let note = "";
      const noteMatch = text.match(/Ghi chú:\s*([\s\S]*?)(\n\n|$)/); // Lấy đến khi xuống dòng kép hoặc hết text
      if (noteMatch) {
         // Xử lý chuỗi note cho gọn (xoá xuống dòng thừa)
         note = noteMatch[1].replace(/\n/g, " ").trim();
      }

      // -- PHÂN LOẠI MÀU SẮC & LOẠI LỊCH --
      let type = "ly-thuyet";
      
      // Cách 1: Check text trực tiếp (Chính xác nhất cho Lịch Online)
      if (text.includes("Trực tuyến") || room.toLowerCase().includes("trực tuyến")) {
        type = "truc-tuyen";
      }
      // Cách 2: Check màu nền (Dự phòng cho Lịch thi / Thực hành)
      const style = div.getAttribute("style") || "";
      const bgClass = div.className; // color-lichthi
      
      if (type !== "truc-tuyen") { // Nếu chưa phải trực tuyến mới check màu
        if (style.includes("#71cb35")) type = "thuc-hanh"; // Xanh lá đậm
        else if (style.includes("#e8ffe1") || bgClass.includes("lichthi") || text.includes("Lịch thi")) type = "thi"; // Vàng
      }

      // -- ĐẨY VÀO MẢNG --
      events.push({
        subject: `[IUH] ${subjectName}`,
        start: `${date}T${CONFIG.TIET_TIME[startTiet]}:00+07:00`,
        end: `${date}T${CONFIG.TIET_TIME[endTiet + 1]}:00+07:00`,
        room: room,
        teacher: teacher,
        type: type,
        note: note // Gửi thêm trường note
      });
    });
  });

  return events;
}
  

  // --- LOGIC CHÍNH: QUY TRÌNH ĐỒNG BỘ ---
  async function startSyncProcess() {
    const weeksToSync = prompt("Bạn muốn đồng bộ bao nhiêu tuần tới?", "5");
    if (!weeksToSync) return;
    
    const maxWeeks = parseInt(weeksToSync);
    let allEvents = [];
    let weekStartScan = "";
    let weekEndScan = "";

    const btnSync = document.querySelector("button[style*='position: fixed']");
    const originalText = btnSync.innerText;

    try {
      for (let i = 0; i < maxWeeks; i++) {
        // 1. Lấy ngày đầu tuần hiện tại từ input hidden (để tracking)
        const currentDateInput = document.getElementById("firstDateOffWeek");
        const currentWeekStartVal = currentDateInput ? currentDateInput.value : "Unknown";
        
        btnSync.innerText = `⏳ Đang quét tuần ${i + 1}/${maxWeeks} (${currentWeekStartVal})...`;
        
        // 2. Quét dữ liệu tuần hiện tại
        const weekEvents = scrapeCurrentWeek();
        allEvents = allEvents.concat(weekEvents);
        console.log(`Week ${i+1}: Found ${weekEvents.length} events.`);

        // Ghi nhận ngày bắt đầu/kết thúc quét
        if (i === 0) weekStartScan = Object.values(weekEvents)[0]?.start.split("T")[0] || "2024-01-01"; // Fallback nếu tuần 1 ko có lịch
        // Cập nhật ngày cuối mỗi vòng lặp
        if (weekEvents.length > 0) weekEndScan = weekEvents[weekEvents.length - 1].end.split("T")[0];

        // 3. Nếu chưa phải tuần cuối, bấm Next
        if (i < maxWeeks - 1) {
          const btnNext = document.getElementById("btn_Tiep");
          if (btnNext) {
            const oldDateVal = document.getElementById("firstDateOffWeek").value;
            btnNext.click();
            await waitForNextWeekLoad(oldDateVal); // Chờ DOM đổi
          } else {
            alert("Không tìm thấy nút Tiếp. Dừng quét.");
            break;
          }
        }
      }

      // 4. Gửi dữ liệu
      if (allEvents.length === 0) {
        alert("Không tìm thấy lịch học nào!");
        return;
      }

      btnSync.innerText = "🚀 Đang gửi dữ liệu lên Google...";
      
      // Tính toán lại range ngày chính xác để gửi lên server (cho việc xóa lịch cũ)
      // Lấy ngày nhỏ nhất và lớn nhất trong mảng events
      allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      const finalStart = allEvents[0].start.split("T")[0];
      const finalEnd = allEvents[allEvents.length - 1].end.split("T")[0];

      const payload = {
        weekStart: finalStart,
        weekEnd: finalEnd,
        events: allEvents
      };

      await fetch(CONFIG.API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      alert(`✅ Thành công! Đã đồng bộ ${allEvents.length} sự kiện.\nTừ ${finalStart} đến ${finalEnd}`);

    } catch (err) {
      console.error(err);
      alert("❌ Có lỗi xảy ra: " + err.message);
    } finally {
      btnSync.innerText = originalText;
    }
  }

  // Khởi chạy nút bấm
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createSyncButton);
  } else {
    createSyncButton();
  }

})();