chrome.storage.sync.get(['iuhUser', 'iuhPass', 'autoFillInfo', 'autoClickLogin'], async (result) => {
    const isAutoFill = result.autoFillInfo !== false;
    const isAutoLogin = result.autoClickLogin !== false;

    // Phân tích tham số để biết có đang chạy đồng bộ ngầm không
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auto_sync_mode') === '1') {
        sessionStorage.setItem('iuh_auto_sync_active', 'true');
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Lấy đúng Element từ trang đăng nhập mới
    const userField = document.querySelector('#UserName');
    const passField = document.querySelector('#Password'); 
    const loginBtn = document.querySelector('.authfy-panel.active #form-login input[type="submit"]');

    let hasFilledSuccessfully = false;

    // 1. Tự động điền dữ liệu
    if (isAutoFill && result.iuhUser && result.iuhPass) {
        if (userField && passField) {
            userField.value = result.iuhUser;
            passField.value = result.iuhPass;
            
            userField.dispatchEvent(new Event('input', { bubbles: true }));
            passField.dispatchEvent(new Event('input', { bubbles: true }));
            userField.dispatchEvent(new Event('change', { bubbles: true }));
            passField.dispatchEvent(new Event('change', { bubbles: true }));
            
            console.log("[IUH Sync] 👤 Đã tự động điền MSSV & Mật khẩu.");
            hasFilledSuccessfully = true;
        } else {
            console.log("[IUH Sync] ❌ Không tìm thấy ô nhập liệu, có thể giao diện đã thay đổi.");
        }
    } else {
        hasFilledSuccessfully = true; // Bỏ qua điền tự động
    }

    // 2. Chờ AI giải mã xong thì Click đăng nhập
    document.addEventListener('IuhCaptchaSolved', async () => {
        if (!isAutoLogin) return;

        let waitTimer = 0;
        while (!hasFilledSuccessfully && waitTimer < 3000) {
            await sleep(100);
            waitTimer += 100;
        }

        if (loginBtn) {
            console.log("[IUH Sync] 🚀 Đợi 1.5 giây mô phỏng người thật...");
            await sleep(1500); 
            loginBtn.click();
        }
    });
});