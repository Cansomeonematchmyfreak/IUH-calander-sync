// popup.js
document.addEventListener('DOMContentLoaded', function () {
  const saveBtn = document.getElementById('saveBtn');
  const urlInput = document.getElementById('scriptUrl');
  const status = document.getElementById('status');

  // 1. Tự động load URL đã lưu khi mở popup
  chrome.storage.sync.get(["webAppUrl"], (data) => {
    if (data.webAppUrl) {
      urlInput.value = data.webAppUrl;
      console.log("Đã tải URL cũ:", data.webAppUrl);
    }
  });

  // 2. Xử lý sự kiện bấm nút Lưu
  saveBtn.addEventListener('click', function () {
    const url = urlInput.value.trim();

    // Kiểm tra định dạng link cơ bản
    if (!url || !url.startsWith("https://script.google.com")) {
      status.innerText = "❌ URL không hợp lệ (phải bắt đầu bằng link Apps Script)";
      status.style.color = "red";
      return;
    }

    // Lưu vào bộ nhớ đồng bộ của Chrome
    chrome.storage.sync.set({ "webAppUrl": url }, () => {
      console.log("Đã lưu URL mới:", url);
      status.innerText = "✅ Đã lưu thành công!";
      status.style.color = "green";

      // Đóng popup sau 1 giây
      setTimeout(() => {
        window.close();
      }, 1000);
    });
  });
}); 