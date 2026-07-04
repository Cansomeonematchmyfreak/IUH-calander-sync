// content.js
(function () {
  console.log("[IUH Sync] Content Script Loaded - Dual Mode (Manual & Auto) with AI Solver");


  if (window.jQuery && !window.jQuery.fn.andSelf) {
      window.jQuery.fn.andSelf = window.jQuery.fn.addBack;
      console.log("[IUH Sync] 🛠️ Đã vá thành công lỗi .andSelf() của web trường.");
  }

  // Cấu hình thời gian tương ứng cho từng tiết học của IUH
  const TIET_TIME = {
    1: "06:30", 2: "07:20", 3: "08:10", 4: "09:10", 5: "10:00", 6: "10:50",
    7: "12:30", 8: "13:20", 9: "14:10", 10: "15:10", 11: "16:00", 12: "16:50",
    13: "18:00", 14: "18:50", 15: "19:50", 16: "20:40", 17: "21:30", 18: "22:20" 
  };

  // Bảng phân loại mã màu chuẩn hóa theo Google Calendar API công khai
  const GOOGLE_COLORS = { 
    "ly-thuyet": "1",   // Lavender (Tím nhạt)
    "thuc-hanh": "2",   // Sage (Xanh lá cây nhạt)
    "truc-tuyen": "5",  // Banana (Vàng nhạt)
    "thi": "11",        // Tomato (Đỏ sậm)
    "tam-ngung": "8"    // Graphite (Xám)
  };

  // Bảng ký tự dùng để mapping kết quả dự đoán từ mô hình AI
  const CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let iuhModel = null;

  // =========================================================================
  // GIAO DIỆN: THẺ UI CARD THÔNG BÁO CHO LUỒNG TỰ ĐỘNG (WIDGET GÓC TRÊN PHẢI)
  // =========================================================================
  function updateSyncWidget(message, status = "processing") {
    let widget = document.getElementById("iuh-sync-widget");
    if (!widget) {
        widget = document.createElement("div");
        widget.id = "iuh-sync-widget";
        widget.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000000; 
            width: 320px; padding: 16px; border-radius: 10px; 
            background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.15); 
            font-family: 'Segoe UI', Tahoma, sans-serif; display: flex; 
            flex-direction: column; gap: 8px; border-left: 6px solid #2196F3; 
            box-sizing: border-box; transition: all 0.3s ease;
        `;
        widget.innerHTML = `
            <div style="font-weight: bold; color: #1a73e8; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                🔄 <span>IUH Calendar Sync AI</span>
            </div>
            <div id="iuh-sync-widget-body" style="font-size: 13px; color: #444; line-height: 1.4;"></div>
        `;
        document.body.appendChild(widget);
    }
    
    // Đổi màu thanh trạng thái viền trái dựa vào kết quả
    if (status === "success") widget.style.borderLeftColor = "#4CAF50";
    else if (status === "error") widget.style.borderLeftColor = "#F44336";
    else widget.style.borderLeftColor = "#2196F3";

    document.getElementById("iuh-sync-widget-body").innerText = message;
  }

  // =========================================================================
  // LOGIC LÕI: ĐỢI LOAD TUẦN MỚI & SÀNG LỌC CÀO DỮ LIỆU LỊCH HỌC
  // =========================================================================
  function waitForNextWeek(oldDate) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        const newDate = document.getElementById("firstDateOffWeek")?.value;
        if (newDate && newDate !== oldDate) { 
            clearInterval(check); 
            setTimeout(resolve, 800); // Trễ nhẹ đảm bảo dữ liệu bảng mới đã kết xuất xong
        }
      }, 100);
    });
  }

  function scrapeCurrentWeek(customColorMap) {
    const table = document.querySelector("table.fl-table");
    if (!table) return [];
    const dateMap = {};
    table.querySelectorAll("thead th").forEach((th, idx) => {
      const m = th.innerText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) dateMap[idx] = `${m[3]}-${m[2]}-${m[1]}`;
    });

    // Bảng màu mặc định chuẩn hóa theo ID Google API (nếu client chưa setup)
    const defaultColors = { 
        "ly-thuyet": "1",   // Lavender
        "thuc-hanh": "2",   // Sage
        "truc-tuyen": "5",  // Banana
        "thi": "11",        // Tomato
        "tam-ngung": "8"    // Graphite
    };
    const finalColors = customColorMap || defaultColors;

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

        const room = (text.match(/Phòng:\s*(.+?)(\n|$)/)?.[1] || "Không rõ").trim();
        const teacher = (text.match(/GV:\s*(.+?)(\n|$)/)?.[1] || "Chưa cập nhật").trim();
        let group = div.querySelector('span[lang="lichtheotuan-nhom"]')?.parentElement?.innerText.replace("Nhóm:", "").trim() || "";
        let note = (text.match(/Ghi chú:\s*([\s\S]*?)(\n\n|$)/)?.[1] || "").replace(/\n/g, " ").trim();

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
          room, teacher, type, note, group,
          calendarColorId: finalColors[type] // Lấy ID màu tương ứng
        });
      });
    });
    return events;
}

  // =========================================================================
  // LUỒNG CHẠY 1: ĐỒNG BỘ HOÀN TOÀN TỰ ĐỘNG (SILENT SYNC MODE) VIA UI CARD
  // =========================================================================
  async function startSilentSyncProcess() {
    const webAppUrl = document.documentElement.getAttribute('data-iuh-webapp-url');
    if (!webAppUrl) {
        updateSyncWidget("❌ Thất bại: Thiếu link Google Apps Script trong cấu hình!", "error");
        return;
    }

    // Đọc bảng màu tùy chỉnh từ DOM do bridge.js gán vào
    let customColorMap = null;
    const domColors = document.documentElement.getAttribute('data-iuh-custom-colors');
    if (domColors) {
        try { customColorMap = JSON.parse(domColors); } catch(e) { console.error(e); }
    }
    if (!customColorMap) {
        customColorMap = GOOGLE_COLORS; // Fallback về GOOGLE_COLORS mặc định ở đầu file
    }

    let allEvents = [];
    const numWeeks = 5; 

    try {
      for (let i = 0; i < numWeeks; i++) {
        const currentDate = document.getElementById("firstDateOffWeek")?.value;
        updateSyncWidget(`⏳ Đang cào dữ liệu lịch học: Tuần ${i + 1}/${numWeeks}...`);
        
        // Đã truyền customColorMap vào đây
        const weekData = scrapeCurrentWeek(customColorMap);
        allEvents = allEvents.concat(weekData);

        if (i < numWeeks - 1) {
          const nextBtn = document.getElementById("btn_Tiep");
          if (!nextBtn) break;
          nextBtn.click();
          await waitForNextWeek(currentDate);
        }
      }

      if (allEvents.length === 0) {
          updateSyncWidget("⚠️ Không tìm thấy bất kỳ dữ liệu lịch học nào.", "error");
          return;
      }

      allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
      
      const payload = {
        weekStart: allEvents[0].start.split("T")[0],
        weekEnd: allEvents[allEvents.length - 1].end.split("T")[0],
        events: allEvents
      };

      updateSyncWidget("🚀 Đang đồng bộ dữ liệu sang đám mây Google Calendar...");
      
      const response = await fetch(webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const resultText = await response.text();
      if (resultText.includes("ERROR")) throw new Error(resultText);

      updateSyncWidget("🎉 Tự động cập nhật lịch thành công! Dữ liệu đã đồng bộ.", "success");
      
      setTimeout(() => {
          document.getElementById("iuh-sync-widget")?.remove();
          document.dispatchEvent(new CustomEvent('IuhSyncComplete'));
      }, 3500);

    } catch (err) {
      updateSyncWidget("❌ Lỗi tiến trình ngầm: " + err.message, "error");
    }
  }
  // =========================================================================
  // LUỒNG CHẠY 2: ĐỒNG BỘ THỦ CÔNG (MANUAL SYNC MODE) VIA NÚT BẤM
  // =========================================================================
  function createSyncButton() {
    const isAutoSync = document.documentElement.getAttribute('data-iuh-auto-sync-active') === 'true';
    if (isAutoSync || document.getElementById("iuh-sync-btn")) return;
    if (!window.location.href.includes('lich-theo-tuan') && !window.location.href.includes('LichHoc')) return; 

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
    btn.addEventListener("click", startManualSyncProcess);
    document.body.appendChild(btn);
  }

  async function startManualSyncProcess() {
    const webAppUrl = document.documentElement.getAttribute('data-iuh-webapp-url');
    if (!webAppUrl) {
      alert("Vui lòng dán link Apps Script vào Popup trước!");
      return;
    }
    const numWeeks = prompt("Nhập số tuần muốn đồng bộ thủ công:", "5");
    if (!numWeeks || isNaN(numWeeks)) return;

    let allEvents = [];
    const btn = document.getElementById("iuh-sync-btn");
    const originalText = btn.innerText;

    // Đọc màu tùy chỉnh chuẩn bị cho chế độ thủ công
    let customColorMap = GOOGLE_COLORS;
    const domColors = document.documentElement.getAttribute('data-iuh-custom-colors');
    if (domColors) { try { customColorMap = JSON.parse(domColors); } catch(e){} }

    try {
      for (let i = 0; i < parseInt(numWeeks); i++) {
        const currentDate = document.getElementById("firstDateOffWeek")?.value;
        btn.innerText = `⏳ Đang quét: Tuần ${i + 1}/${numWeeks}...`;
        
        // Đã truyền customColorMap vào đây
        const weekData = scrapeCurrentWeek(customColorMap);
        allEvents = allEvents.concat(weekData);

        if (i < parseInt(numWeeks) - 1) {
          const nextBtn = document.getElementById("btn_Tiep");
          if (!nextBtn) break;
          nextBtn.click();
          await waitForNextWeek(currentDate);
        }
      }

      if (allEvents.length === 0) throw new Error("Không tìm thấy dữ liệu lịch học.");
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
      if (resultText.includes("ERROR")) throw new Error(resultText);
      
      alert(`✅ Đồng bộ thủ công hoàn tất!\nKết quả từ máy chủ: ${resultText}`);
      document.dispatchEvent(new CustomEvent('IuhManualSyncComplete'));

    } catch (err) {
      alert("❌ Lỗi đồng bộ:\n" + err.message);
    } finally {
      btn.innerText = originalText;
    }
  }

  // =========================================================================
  // PHẦN 3: AUTO CAPTCHA SOLVER (MÔ HÌNH AI TENSORFLOW.JS)
  // =========================================================================
  async function loadAIModel() {
    try {
        const extBaseUrl = document.documentElement.getAttribute('data-iuh-ext-url');
        if (!extBaseUrl) return;
        const modelUrl = extBaseUrl + 'tfjs_model/model.json';
        iuhModel = await tf.loadLayersModel(modelUrl);
    } catch (error) {
        console.error("[IUH Sync] ❌ Lỗi nạp mô hình AI:", error);
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

        console.log("[IUH Sync] 🎯 AI nhận dạng mã Captcha thành công:", result);
        
        // Kích hoạt click Đăng Nhập
        document.dispatchEvent(new CustomEvent('IuhCaptchaSolved'));

        tf.dispose(tensor);
        tf.dispose(prediction);
    } catch (err) {
        console.error("[IUH Sync] ❌ Lỗi tiến trình giải mã AI:", err);
    }
  }

  let aiTriggered = false; 
  const checkExist = setInterval(() => {
    const isAutoCap = document.documentElement.getAttribute('data-iuh-auto-captcha');
    if (isAutoCap === "false") {
        clearInterval(checkExist);
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

  // =========================================================================
  // BỘ NHẬN DIỆN VÀ TỰ ĐỘNG BẺ LÁI (THAY THẾ SESSION STORAGE)
  // =========================================================================
  // Đợi 500ms để bridge.js kịp móc dữ liệu gắn cờ lên HTML DOM
  setTimeout(() => {
      const isAutoSync = document.documentElement.getAttribute('data-iuh-auto-sync-active') === 'true';
      
      if (isAutoSync) {
          const currentUrl = window.location.href.toLowerCase();
          
          // 1. Đúng trang cần thiết -> Khởi chạy ngầm
          if (currentUrl.includes('lich-theo-tuan') || currentUrl.includes('lichhoc')) {
              updateSyncWidget("📅 Đã vào trang lịch học. Chuẩn bị cào dữ liệu ngầm...");
              setTimeout(startSilentSyncProcess, 1500);
          } 
          // 2. Đi lạc ra các trang khác (Dashboard...) -> Bắt quay xe về trang lịch học
          else if (!currentUrl.includes('dang-nhap')) {
              updateSyncWidget("🔄 Hệ thống nhận diện đã đăng nhập sẵn. Đang điều hướng đến Lịch Học...");
              setTimeout(() => {
                  window.location.href = "https://sv.iuh.edu.vn/lich-theo-tuan.html";
              }, 1000);
          }
      } else {
          // Trạng thái bình thường không chạy ngầm -> Bật nút thủ công nếu đang ở trang lịch
          createSyncButton();
      }
  }, 500);
  
})();