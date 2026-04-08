(function () {
  console.log("[IUH Sync] Content Script Loaded - Version 4.0");

  // ==========================================
  // PHẦN 1: LOGIC ĐỒNG BỘ LỊCH (Giữ nguyên của bạn)
  // ==========================================
  const TIET_TIME = {
    1: "06:30", 2: "07:20", 3: "08:10", 4: "09:10", 5: "10:00", 6: "10:50",
    7: "12:30", 8: "13:20", 9: "14:10", 10: "15:10", 11: "16:00", 12: "16:50",
    13: "18:00", 14: "18:50", 15: "19:50", 16: "20:40", 17: "21:30", 18: "22:20" 
  };

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
    btn.addEventListener("click", startMultiWeekSync);
    document.body.appendChild(btn);
  }

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
        const text = div.innerText;
        const style = div.getAttribute("style") || "";
        const dataBg = div.getAttribute("data-bg"); 
        const subjectName = div.querySelector("a")?.innerText.trim() || "Môn học";
        const tietMatch = text.match(/Tiết:\s*(\d+)\s*-\s*(\d+)/);
        if (!tietMatch) return; 

        const roomMatch = text.match(/Phòng:\s*(.+?)(\n|$)/);
        const room = roomMatch ? roomMatch[1].trim() : "Không rõ";
        const gvMatch = text.match(/GV:\s*(.+?)(\n|$)/);
        const teacher = gvMatch ? gvMatch[1].trim() : "Chưa cập nhật";
        
        let group = "";
        const groupSpan = div.querySelector('span[lang="lichtheotuan-nhom"]');
        if (groupSpan && groupSpan.parentElement) {
            group = groupSpan.parentElement.innerText.replace("Nhóm:", "").trim().replace(":", "").trim();
        }

        let note = "";
        const noteMatch = text.match(/Ghi chú:\s*([\s\S]*?)(\n\n|$)/);
        if (noteMatch) note = noteMatch[1].replace(/\n/g, " ").trim();

        const startTiet = parseInt(tietMatch[1]);
        const endTiet = parseInt(tietMatch[2]);
        const startTime = TIET_TIME[startTiet];
        const endTime = TIET_TIME[endTiet + 1]; 

        if (!startTime || !endTime) return; 

        let type = "ly-thuyet"; 
        if (div.querySelector(".tamngung") || text.includes("Tạm ngưng")) type = "tam-ngung";
        else if (dataBg === "208412" || group !== "" || text.includes("Lịch thi")) type = "thi"; 
        else if (style.includes("#92d6ff") || text.includes("Trực tuyến") || room.toLowerCase().includes("zoom")) type = "truc-tuyen";
        else if (style.includes("#71cb35") || text.includes("Thực hành")) type = "thuc-hanh"; 

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

  async function startMultiWeekSync() {
    const webAppUrl = document.documentElement.getAttribute('data-iuh-webapp-url');
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

      btn.innerText = "🚀 Đang gửi dữ liệu lên Google Calendar...";
      const response = await fetch(webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const resultText = await response.text();
      
      if (resultText.includes("ERROR") || resultText.includes("No data")) {
        throw new Error("Lỗi từ máy chủ: " + resultText);
      }
      alert(`✅ Hoàn tất!\nKết quả từ Google Calendar: ${resultText}`);
    } catch (err) {
      alert("❌ Lỗi đồng bộ:\n" + err.message);
    } finally {
      btn.innerText = originalText;
    }
  }
  createSyncButton();

  // ==========================================
  // PHẦN 2: AUTO CAPTCHA SOLVER (TENSORFLOW.JS)
  // ==========================================
  const CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let iuhModel = null;

  async function loadAIModel() {
    try {
        const extBaseUrl = document.documentElement.getAttribute('data-iuh-ext-url');
        if (!extBaseUrl) return;
        const modelUrl = extBaseUrl + 'tfjs_model/model.json';
        iuhModel = await tf.loadLayersModel(modelUrl);
    } catch (error) {
        console.error("[IUH Sync] ❌ Lỗi nạp Model:", error);
    }
  }

  function preprocessCaptcha(imgElement) {
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgElement, 0, 0, 150, 50);
    const imageData = ctx.getImageData(0, 0, 150, 50);
    
    return tf.tidy(() => {
        let tensor = tf.browser.fromPixels(imageData, 1);
        tensor = tensor.toFloat().div(tf.scalar(255.0));
        return tensor.expandDims(0);
    });
  }

  async function solveIUHCaptcha() { 
    await loadAIModel();
    if (!iuhModel) return;

    const imgElement = document.querySelector('#newcaptcha'); 
    const inputElement = document.querySelector('#Captcha');
    if (!imgElement || !inputElement) return;

    try {
        const tensor = preprocessCaptcha(imgElement);
        const prediction = iuhModel.predict(tensor);
        const data = prediction.dataSync(); 
        let result = "";
        
        for(let i = 0; i < 4; i++) {
            let maxVal = -1;
            let maxIdx = -1;
            for(let j = 0; j < 36; j++) {
                let val = data[i * 36 + j];
                if(val > maxVal) { maxVal = val; maxIdx = j; }
            }
            result += CHARACTERS[maxIdx];
        }
        
        inputElement.value = result;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        console.log("[IUH Sync] 🎯 AI chốt mã:", result);
        
        // Bắn tín hiệu ra cho autologin.js biết để bấm nút
        document.dispatchEvent(new CustomEvent('IuhCaptchaSolved'));

        tf.dispose(tensor);
        tf.dispose(prediction);
    } catch (err) {
        console.error("[IUH Sync] ❌ Lỗi giải mã:", err);
    }
  }

  // ==========================================
  // PHẦN 3: MẮT THẦN QUÉT CAPTCHA
  // ==========================================
  let aiTriggered = false; 

  const checkExist = setInterval(() => {
    const isAutoCap = document.documentElement.getAttribute('data-iuh-auto-captcha');
    if (isAutoCap === "false") {
        clearInterval(checkExist);
        console.log("[IUH Sync] 🛑 AI giải mã đang TẮT.");
        return;
    }

    const imgElement = document.querySelector('#newcaptcha'); 
    const inputElement = document.querySelector('#Captcha'); 
    
    if (imgElement && inputElement && !aiTriggered) {
        aiTriggered = true; 
        clearInterval(checkExist); 
        setTimeout(solveIUHCaptcha, 500); 
    }
}, 500);

})(); // <-- CÁI NGOẶC QUAN TRỌNG NHẤT LÀ ĐÂY!!!