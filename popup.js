document.addEventListener('DOMContentLoaded', function () {
  const saveBtn = document.getElementById('saveBtn');
  const urlInput = document.getElementById('scriptUrl');
  const userInp = document.getElementById('username');
  const passInp = document.getElementById('password');
  const autoCap = document.getElementById('autoCaptcha');
  const status = document.getElementById('status');
  
  // NÚT BẬT TẮT CON MẮT
  const togglePassword = document.getElementById('togglePassword');

  // Sự kiện click con mắt
  // Sự kiện click con mắt (Bản cập nhật dùng SVG)
  togglePassword.addEventListener('click', function () {
    const isPassword = passInp.getAttribute('type') === 'password';
    
    // Đảo ngược type
    passInp.setAttribute('type', isPassword ? 'text' : 'password');
    this.title = isPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
    
    // Đổi hình vẽ SVG
    if (isPassword) {
      // Icon MẮT MỞ
      this.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0056b3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    } else {
      // Icon MẮT ĐÓNG (Gạch chéo)
      this.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    }
  });
  // 2. Xử lý sự kiện bấm nút Lưu
  saveBtn.addEventListener('click', function () {
    const url = urlInput.value.trim();
    const user = userInp.value.trim();
    const pass = passInp.value;
    const isAuto = autoCap.checked;

    if (url && !url.startsWith("https://script.google.com")) {
      status.innerText = "❌ URL không hợp lệ!";
      status.style.color = "red";
      return;
    }

    // Lưu toàn bộ vào bộ nhớ
    chrome.storage.sync.set({ 
        "webAppUrl": url,
        "iuhUser": user,
        "iuhPass": pass,
        "autoCaptcha": isAuto 
    }, () => {
      status.innerText = "✅ Đã lưu thành công!";
      status.style.color = "green";
      setTimeout(() => window.close(), 1000);
    });
  });
});