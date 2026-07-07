// survey_agent.js
const surveySleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async function handleAutoSurveyContext() {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  const state = await chrome.storage.local.get([
    'iuh_auto_survey_running', 
    'iuh_survey_current_index', 
    'iuh_survey_urls'
  ]);
  
  if (!state.iuh_auto_survey_running) return;

  const currentUrl = window.location.href;
  let currentIndex = state.iuh_survey_current_index || 0;
  let urls = state.iuh_survey_urls || [];

  // --- KỊCH BẢN A: ĐANG TẠI MÀN HÌNH DANH SÁCH PHIẾU KHẢO SÁT ---
  if (currentUrl.includes('/sinh-vien/danh-sach-khao-sat.html')) {
    
    await surveySleep(500); // Chờ nhẹ giao diện ổn định

    if (urls.length === 0) {
      const pendingElements = document.querySelectorAll('#tab_chuaks .item a.title');
      urls = Array.from(pendingElements).map(a => 'https://sv.iuh.edu.vn' + a.getAttribute('href'));

      if (urls.length === 0) {
        await chrome.storage.local.set({ iuh_auto_survey_running: false, iuh_survey_current_index: 0, iuh_survey_urls: [] });
        alert('Bạn không còn phiếu khảo sát học phần nào chưa làm.');
        return;
      }
      await chrome.storage.local.set({ iuh_survey_urls: urls, iuh_survey_current_index: 0 });
      currentIndex = 0;
    }

    injectSurveyOverlay(currentIndex, urls.length, "Đang chuẩn bị đẩy tab khảo sát ngầm...");

    if (currentIndex < urls.length) {
      // TĂNG TIẾN TRÌNH TRƯỚC: Để khi tab con mở ra và đóng lại, trang mẹ reload sẽ chạy tiếp môn sau
      await chrome.storage.local.set({ iuh_survey_current_index: currentIndex + 1 });
      
      // Bắn tin nhắn yêu cầu background mở và GHIM tab mới tốc độ cao
      chrome.runtime.sendMessage({
          action: "openAndPinSurveyTab",
          url: urls[currentIndex]
      });
    } else {
      // Đã hoàn thành toàn bộ danh sách URL
      await chrome.storage.local.set({ iuh_auto_survey_running: false, iuh_survey_current_index: 0, iuh_survey_urls: [] });
      injectSurveyOverlay(urls.length, urls.length, "Hoàn thành nhiệm vụ!");
      await surveySleep(400);
      alert('Toàn bộ phiếu khảo sát học phần đã được xử lý thành công!');
      window.location.reload();
    }
  }
  
  // --- KỊCH BẢN B: ĐANG TRONG TAB CHI TIẾT ĐIỀN KHẢO SÁT (ĐANG BỊ GHIM) ---
  else if (currentUrl.includes('/sinh-vien/chi-tiet-phieu-khao-sat.html')) {
    
    injectSurveyOverlay(currentIndex, urls.length, "Đang điền nhanh dữ liệu form...");
    
    // 1. Điền trắc nghiệm mức "Bình thường" lập tức không cần trễ
    const radioGroups = document.querySelectorAll('ul.group-cautraloi');
    radioGroups.forEach(ul => {
      const labels = Array.from(ul.querySelectorAll('label'));
      const targetLabel = labels.find(l => l.textContent.includes('Bình thường'));
      if (targetLabel) {
        const radioInput = targetLabel.querySelector('input[type="radio"]');
        if (radioInput) radioInput.click();
      }
    });

    // 2. Điền ý kiến tự luận
    const textareas = document.querySelectorAll('textarea.input-ykien');
    textareas.forEach(textarea => {
      textarea.value = "Không";
    });

    // 3. Click nút nộp bài ngay
    const btnGui = document.getElementById('btnGui');
    if (btnGui) {
      btnGui.click(); 
    }

    // 4. KIỂM TRA PHẢN HỒI SAU KHI CLICK NỘP: 
    // Sau khi click btnGui, hệ thống trường sẽ xử lý nộp bài và chuyển hướng URL. 
    // Ta bắt khoảnh khắc trang web bắt đầu dời đi để phát lệnh đóng tab ngay lập tức (Tiết kiệm thời gian chờ tải lại)
    window.addEventListener('unload', () => {
        chrome.runtime.sendMessage({ action: "closeSurveyTab" });
    });
    
    // Dự phòng trường hợp trang phản hồi quá nhanh mà không trigger unload
    await surveySleep(400);
    chrome.runtime.sendMessage({ action: "closeSurveyTab" });
  }
})();

function injectSurveyOverlay(current, total, msgText) {
  let overlay = document.getElementById('iuh-extension-survey-overlay');
  const rate = total > 0 ? Math.round((current / total) * 100) : 0;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'iuh-extension-survey-overlay';
    overlay.style = `
      position: fixed; top: 30px; right: 30px; z-index: 2147483647;
      background: #fff; border: 2px solid #28a745; padding: 16px;
      border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.18);
      width: 310px; font-family: Arial, sans-serif; box-sizing: border-box;
    `;
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <h4 style="margin: 0 0 6px 0; color: #28a745; font-size: 15px; font-weight: bold;">📊 IUH Auto Survey Active</h4>
    <div style="font-size: 12px; color: #666; font-style: italic; margin-bottom: 8px;">${msgText}</div>
    <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px;">Tiến trình: Môn số ${current}/${total} (${rate}%)</div>
    <div style="background: #e9ecef; border-radius: 4px; height: 14px; width: 100%; overflow: hidden; margin-bottom: 10px;">
      <div style="background: #28a745; width: ${rate}%; height: 100%; transition: width 0.2s ease;"></div>
    </div>
    <button id="iuh-btn-abort-survey" style="width: 100%; background: #dc3545; color: #fff; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">Hủy Lệnh Khẩn Cấp</button>
  `;

  document.getElementById('iuh-btn-abort-survey').addEventListener('click', async () => {
    await chrome.storage.local.set({ iuh_auto_survey_running: false, iuh_survey_current_index: 0, iuh_survey_urls: [] });
    alert('Đã hủy chế độ tự động khảo sát ngầm.');
    window.location.href = 'https://sv.iuh.edu.vn/sinh-vien/danh-sach-khao-sat.html';
  });
}