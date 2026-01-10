// content.js - Version 3.2 (Fix lỗi "room is not defined")
(function () {
  console.log("[IUH Sync] Content Script Loaded - Version 3.2");

  // --- CẤU HÌNH THỜI GIAN TIẾT HỌC ---
  // Đã thêm tiết 17, 18 để tránh lỗi tính giờ ra về cho ca thi tối
  const TIET_TIME = {
    1: "06:30", 2: "07:20", 3: "08:10", 4: "09:10", 5: "10:00", 6: "10:50",
    7: "12:30", 8: "13:20", 9: "14:10", 10: "15:10", 11: "16:00", 12: "16:50",
    13: "18:00", 14: "18:50", 15: "19:50", 16: "20:40",
    17: "21:30", 18: "22:20" 
  };

  // --- 1. TẠO GIAO DIỆN NÚT BẤM ---
  function createSyncButton() {
    if (document.getElementById("iuh-sync-btn")) return;
    const btn = document.createElement("button");
    btn.id = "iuh-sync-btn";
    btn.innerText = "📅 Đồng bộ sang Google Calendar";
    btn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      padding: 12px 24px; background: #0f9d58; color: white; border: none;
      border-radius: 50px; font-weight: bold; cursor: pointer;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-family: 'Segoe UI', sans-serif;
      transition: all 0.3s;
    `;
    btn.onmouseover = () => btn.style.transform = "scale(1.05)";
    btn.onmouseout = () => btn.style.transform = "scale(1)";
    
    // Sử dụng addEventListener để tránh lỗi CSP
    btn.addEventListener("click", startMultiWeekSync);
    
    document.body.appendChild(btn);
  }

  // --- 2. LOGIC ĐỢI TRANG TẢI ---
  function waitForNextWeek(oldDate) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        const newDate = document.getElementById("firstDateOffWeek")?.value;
        if (newDate && newDate !== oldDate) {
          clearInterval(check);
          setTimeout(resolve, 800); 
        }
      }, 100);
    });
  }

  // --- 3. QUÉT DỮ LIỆU ---
  function scrapeCurrentWeek() {
    const table = document.querySelector("table.fl-table");
    if (!table) return [];

    const dateMap = {};
    table.querySelectorAll("thead th").forEach((th, idx) => {
      const m = th.innerText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) dateMap[idx] = `${m[3]}-${m[2]}-${m[1]}`;
    });

    const events = [];
    table.querySelectorAll("tbody tr td").forEach((cell) => {
      const date = dateMap[cell.cellIndex];
      if (!date) return;

      cell.querySelectorAll(".content").forEach(div => {
        // --- BƯỚC 1: LẤY THÔNG TIN CƠ BẢN (KHAI BÁO BIẾN TRƯỚC) ---
        const text = div.innerText;
        const style = div.getAttribute("style") || "";
        const dataBg = div.getAttribute("data-bg"); 
        
        // Lấy tên môn
        const subjectName = div.querySelector("a")?.innerText.trim() || "Môn học";

        // Lấy Tiết học (Quan trọng)
        const tietMatch = text.match(/Tiết:\s*(\d+)\s*-\s*(\d+)/);
        if (!tietMatch) return; // Không có tiết thì bỏ qua ngay

        // Lấy Phòng (Khai báo biến room ngay tại đây để tránh lỗi not defined)
        const roomMatch = text.match(/Phòng:\s*(.+?)(\n|$)/);
        const room = roomMatch ? roomMatch[1].trim() : "Không rõ";

        // Lấy Giảng viên
        const gvMatch = text.match(/GV:\s*(.+?)(\n|$)/);
        const teacher = gvMatch ? gvMatch[1].trim() : "CB Coi Thi / Chưa cập nhật";

        // Lấy Nhóm thi (nếu có)
        let group = "";
        const groupSpan = div.querySelector('span[lang="lichtheotuan-nhom"]');
        if (groupSpan && groupSpan.parentElement) {
            group = groupSpan.parentElement.innerText.replace("Nhóm:", "").trim().replace(":", "").trim();
        }

        // Lấy Ghi chú
        let note = "";
        const noteMatch = text.match(/Ghi chú:\s*([\s\S]*?)(\n\n|$)/);
        if (noteMatch) note = noteMatch[1].replace(/\n/g, " ").trim();

        // --- BƯỚC 2: TÍNH TOÁN THỜI GIAN ---
        const startTiet = parseInt(tietMatch[1]);
        const endTiet = parseInt(tietMatch[2]);
        const startTime = TIET_TIME[startTiet];
        const endTime = TIET_TIME[endTiet + 1]; 

        // Kiểm tra lỗi tính giờ
        if (!startTime || !endTime) {
            console.warn(`⚠️ Bỏ qua môn: ${subjectName} do không tính được giờ (Tiết ${startTiet}-${endTiet})`);
            return; 
        }

        // --- BƯỚC 3: PHÂN LOẠI MÀU SẮC (SỬ DỤNG BIẾN ROOM ĐÃ KHAI BÁO) ---
        let type = "ly-thuyet"; // Mặc định
        
        if (div.querySelector(".tamngung") || text.includes("Tạm ngưng")) {
          type = "tam-ngung";
        } 
        else if (dataBg === "208412" || group !== "" || text.includes("Lịch thi")) { 
          // Ưu tiên 1: Mã màu vàng của IUH (208412) hoặc có thông tin Nhóm -> LÀ LỊCH THI
          type = "thi"; 
        } 
        else if (style.includes("#92d6ff") || text.includes("Trực tuyến") || room.toLowerCase().includes("zoom")) {
          type = "truc-tuyen";
        } 
        else if (style.includes("#71cb35") || text.includes("Thực hành")) {
          type = "thuc-hanh"; 
        }

        events.push({
          subject: `[IUH] ${subjectName} ${type === 'thi' ? '(THI)' : ''}`,
          start: `${date}T${startTime}:00+07:00`,
          end: `${date}T${endTime}:00+07:00`,
          room, teacher, type, note, group
        });
      });
    });
    return events;
  }

  // --- 4. TIẾN TRÌNH CHÍNH ---
  async function startMultiWeekSync() {
    const storage = await chrome.storage.sync.get("webAppUrl");
    const webAppUrl = storage.webAppUrl;

    if (!webAppUrl) {
      alert("Vui lòng dán link Apps Script vào Popup trước!");
      return;
    }

    const numWeeks = prompt("Nhập số tuần muốn đồng bộ:", "5");
    if (!numWeeks || isNaN(numWeeks)) return;

    let allEvents = [];
    const btn = document.getElementById("iuh-sync-btn");
    const originalText = btn.innerText;

    try {
      for (let i = 0; i < parseInt(numWeeks); i++) {
        const currentDate = document.getElementById("firstDateOffWeek")?.value;
        btn.innerText = `⏳ Đang quét: Tuần ${i + 1}/${numWeeks}...`;

        const weekData = scrapeCurrentWeek();
        allEvents = allEvents.concat(weekData);

        if (i < parseInt(numWeeks) - 1) {
          const nextBtn = document.getElementById("btn_Tiep");
          if (!nextBtn) break;
          nextBtn.click();
          await waitForNextWeek(currentDate);
        }
      }

      if (allEvents.length === 0) throw new Error("Không tìm thấy dữ liệu.");

      allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      
      const payload = {
        weekStart: allEvents[0].start.split("T")[0],
        weekEnd: allEvents[allEvents.length - 1].end.split("T")[0],
        events: allEvents
      };

      btn.innerText = "🚀 Đang gửi dữ liệu...";
      
      const response = await fetch(webAppUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      alert(`✅ Đã gửi lệnh đồng bộ ${allEvents.length} sự kiện!\nHãy kiểm tra Google Calendar.`);

    } catch (err) {
      console.error(err);
      alert("Lỗi: " + err.message);
    } finally {
      btn.innerText = originalText;
    }
  }

  createSyncButton();
})();