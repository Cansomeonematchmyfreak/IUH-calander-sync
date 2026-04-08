// autologin.js
chrome.storage.sync.get(['iuhUser', 'iuhPass', 'autoFillInfo', 'autoClickLogin'], (result) => {
    // Nếu người dùng chưa set (undefined), mặc định coi như là Bật (true)
    const isAutoFill = result.autoFillInfo !== false;
    const isAutoLogin = result.autoClickLogin !== false;

    // Bộ chọn quét mọi ngóc ngách để tìm đúng ô MSSV và Mật khẩu (Chống ID động của ASP.NET)
    const userField = document.querySelector('#txtTaiKhoan, input[name*="TaiKhoan"], input[type="text"]:not(#Captcha)');
    const passField = document.querySelector('#txtMatKhau, input[type="password"]'); 

    // ==========================================
    // 1. CHỨC NĂNG: TỰ ĐỘNG ĐIỀN THÔNG TIN
    // ==========================================
    if (isAutoFill) {
        if (result.iuhUser && result.iuhPass) {
            if (userField && passField) {
                // Điền dữ liệu
                userField.value = result.iuhUser;
                passField.value = result.iuhPass;
                
                // Kích hoạt sự kiện để web trường nhận diện có người đang gõ phím
                userField.dispatchEvent(new Event('input', { bubbles: true }));
                passField.dispatchEvent(new Event('input', { bubbles: true }));
                userField.dispatchEvent(new Event('change', { bubbles: true }));
                passField.dispatchEvent(new Event('change', { bubbles: true }));
                
                console.log("[IUH Sync] 👤 Đã tự động chốt MSSV & Mật khẩu.");
            } else {
                console.log("[IUH Sync] ❌ Không tìm thấy ô nhập liệu trên web trường!");
            }
        } else {
            console.log("[IUH Sync] ⚠️ Chưa có dữ liệu tài khoản trong Popup Extension.");
        }
    } else {
        console.log("[IUH Sync] 🛑 Chức năng tự động điền đang TẮT.");
    }

    // ==========================================
    // 2. CHỨC NĂNG: TỰ ĐỘNG BẤM NÚT ĐĂNG NHẬP
    // ==========================================
    // Chỉ kích hoạt KHI VÀ CHỈ KHI nhận được tín hiệu AI đã giải xong mã CAPTCHA
    document.addEventListener('IuhCaptchaSolved', () => {
        if (isAutoLogin) {
            // Bao trọn gói ID của nút Đăng Nhập
            const loginBtn = document.querySelector('#btnDangNhap, input[type="submit"], button[type="submit"]');
            if (loginBtn) {
                console.log("[IUH Sync] 🚀 Đang tiến hành đăng nhập sau 1 giây...");
                
                // Delay 1 giây (1000ms) để giống người thật, tránh bị trường ban IP
                setTimeout(() => {
                    loginBtn.click();
                }, 2200); 
            }
        } else {
            console.log("[IUH Sync] 🛑 Tự động bấm nút đang TẮT!");
        }
    });
});