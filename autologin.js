// autologin.js
chrome.storage.sync.get(['iuhUser', 'iuhPass', 'autoCaptcha'], (result) => {
    const isAuto = result.autoCaptcha !== false; // Mặc định là Bật
    const userField = document.querySelector('#txtTaiKhoan, input[name*="TaiKhoan"], input[type="text"]:not(#Captcha)');
    const passField = document.querySelector('#txtMatKhau, input[type="password"]'); 

    // TRƯỜNG HỢP 1: NẾU BẠN TẮT AI -> CHỈ ĐIỀN TK/MK RỒI DỪNG LẠI
    if (!isAuto) {
        if (result.iuhUser && result.iuhPass && userField && passField) {
            userField.value = result.iuhUser;
            passField.value = result.iuhPass;
            userField.dispatchEvent(new Event('input', { bubbles: true }));
            passField.dispatchEvent(new Event('input', { bubbles: true }));
            console.log("[IUH Sync] 👤 Đã điền sẵn tài khoản (Chế độ gõ tay).");
        }
        return; 
    }

    // TRƯỜNG HỢP 2: NẾU BẬT AI -> ĐỢI AI GIẢI MÃ XONG MỚI ĐIỀN VÀ BẤM NÚT
    document.addEventListener('IuhCaptchaSolved', () => {
        console.log("[IUH Sync] 🚀 AI đã giải xong mã! Đang chốt hạ tài khoản...");
        if (result.iuhUser && result.iuhPass && userField && passField) {
            userField.value = result.iuhUser;
            passField.value = result.iuhPass;
            userField.dispatchEvent(new Event('input', { bubbles: true }));
            passField.dispatchEvent(new Event('input', { bubbles: true }));
            userField.dispatchEvent(new Event('change', { bubbles: true }));
            passField.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Tìm nút Đăng Nhập và bấm
        const loginBtn = document.querySelector('#btnDangNhap, input[type="submit"], button[type="submit"]');
        if (loginBtn) {
            setTimeout(() => { loginBtn.click(); }, 500); 
        }
    });
});