document.addEventListener('DOMContentLoaded', function () {
    // 1. LIÊN KẾT ĐÚNG ID TỪ HTML
    const urlInput = document.getElementById('scriptUrl');
    const userInp = document.getElementById('username');
    const passInp = document.getElementById('password');
    
    const autoFillInfo = document.getElementById('autoFillInfo');
    const autoCaptcha = document.getElementById('autoCaptcha');
    const autoClickLogin = document.getElementById('autoClickLogin');
    
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');
    const togglePassword = document.getElementById('togglePassword');
    const eyeIcon = document.getElementById('eyeIcon');

    // 2. LOAD DỮ LIỆU TỪ STORAGE
    chrome.storage.sync.get([
        "webAppUrl", "iuhUser", "iuhPass", 
        "autoFillInfo", "autoCaptcha", "autoClickLogin"
    ], (data) => {
        if (data.webAppUrl) urlInput.value = data.webAppUrl;
        if (data.iuhUser) userInp.value = data.iuhUser;
        if (data.iuhPass) passInp.value = data.iuhPass;
        
        // Mặc định BẬT các công tắc nếu chưa từng lưu
        autoFillInfo.checked = data.autoFillInfo !== false;
        autoCaptcha.checked = data.autoCaptcha !== false;
        autoClickLogin.checked = data.autoClickLogin !== false;
    });

    // 3. XỬ LÝ CON MẮT (ẨN/HIỆN MẬT KHẨU)
    togglePassword.addEventListener('click', function () {
        const isPassword = passInp.getAttribute('type') === 'password';
        passInp.setAttribute('type', isPassword ? 'text' : 'password');
        
        if (isPassword) {
            // Icon Mắt Mở (Xanh dương)
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>`;
            eyeIcon.setAttribute('stroke', '#0056b3');
        } else {
            // Icon Mắt Đóng (Xám)
            eyeIcon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>`;
            eyeIcon.setAttribute('stroke', '#666');
        }
    });

    // 4. LƯU DỮ LIỆU KHI BẤM NÚT
    saveBtn.addEventListener('click', function () {
        const vals = {
            webAppUrl: urlInput.value.trim(),
            iuhUser: userInp.value.trim(),
            iuhPass: passInp.value,
            autoFillInfo: autoFillInfo.checked,
            autoCaptcha: autoCaptcha.checked,
            autoClickLogin: autoClickLogin.checked
        };

        chrome.storage.sync.set(vals, () => {
            status.innerText = "✅ Đã lưu thành công!";
            status.style.color = "green";
            
            // Đóng cửa sổ popup sau 1 giây
            setTimeout(() => {
                window.close();
            }, 1000);
        });
    });
});