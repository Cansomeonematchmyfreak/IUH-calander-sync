document.addEventListener('DOMContentLoaded', () => {
    const scriptUrlInput = document.getElementById('scriptUrl');
    const userInp = document.getElementById('username');
    const passInp = document.getElementById('password');

    const autoSyncToggle = document.getElementById('autoSyncEnabled');
    const autoFillToggle = document.getElementById('autoFillInfo');
    const autoCaptchaToggle = document.getElementById('autoCaptcha');
    const autoClickToggle = document.getElementById('autoClickLogin');

    const colorLT = document.getElementById('color-ly-thuyet');
    const colorTH = document.getElementById('color-thuc-hanh');
    const colorTT = document.getElementById('color-truc-tuyen');
    const colorThi = document.getElementById('color-thi');
    const colorTN = document.getElementById('color-tam-ngung');

    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    const colorSelects = [colorLT, colorTH, colorTT, colorThi, colorTN];
    let previousColors = {};

    const googleColorsHex = {
        "1": "#7986cb",  // Lavender
        "2": "#33b679",  // Sage
        "3": "#8e24aa",  // Grape
        "4": "#e67c73",  // Flamingo
        "5": "#f6bf26",  // Banana
        "6": "#f4511e",  // Tangerine
        "7": "#039be5",  // Peacock
        "8": "#616161",  // Graphite
        "9": "#3f51b5",  // Blueberry
        "10": "#0b8043", // Basil
        "11": "#d50000"  // Tomato
    };

    function updateColorUI() {
        const selectedValues = colorSelects.map(select => select.value);

        colorSelects.forEach(select => {
            const hexColor = googleColorsHex[select.value];
            if (hexColor) {
                select.style.borderLeft = `8px solid ${hexColor}`;
                select.style.backgroundColor = `${hexColor}15`;
                select.style.fontWeight = "600";
            }

            Array.from(select.options).forEach(option => {
                const cleanText = option.innerText.split(" (🔄")[0];

                if (selectedValues.includes(option.value) && option.value !== select.value) {
                    option.disabled = false;
                    option.style.color = "#888";
                    option.innerText = cleanText + " (🔄 Đổi chỗ)";
                } else {
                    option.disabled = false;
                    option.style.color = "#333";
                    option.innerText = cleanText;
                }
            });
        });
    }

    function handleColorSwap(event) {
        const changedSelect = event.target;
        const newColorId = changedSelect.value;
        const oldColorId = previousColors[changedSelect.id];

        colorSelects.forEach(select => {
            if (select.id !== changedSelect.id && select.value === newColorId) {
                select.value = oldColorId;
                previousColors[select.id] = oldColorId;
            }
        });

        previousColors[changedSelect.id] = newColorId;
        updateColorUI();
    }

    colorSelects.forEach(select => {
        select.addEventListener('change', handleColorSwap);
    });

    chrome.storage.sync.get([
        "webAppUrl", "iuhUser", "iuhPass",
        "autoSyncEnabled", "autoFillInfo", "autoCaptcha", "autoClickLogin",
        "customColors"
    ], (data) => {
        if (data.webAppUrl) scriptUrlInput.value = data.webAppUrl;
        if (data.iuhUser) userInp.value = data.iuhUser;
        if (data.iuhPass) passInp.value = data.iuhPass;

        autoSyncToggle.checked = data.autoSyncEnabled !== false;
        autoFillToggle.checked = data.autoFillInfo !== false;
        autoCaptchaToggle.checked = data.autoCaptcha !== false;
        autoClickToggle.checked = data.autoClickLogin !== false;

        let finalColors = {
            "ly-thuyet": "8",
            "thuc-hanh": "2",
            "truc-tuyen": "9",
            "thi": "5",
            "tam-ngung": "11"
        };

        if (data.customColors) {
            const isSafeColor = (val) => val && val.length > 0 && val.length < 3;
            if (isSafeColor(data.customColors["ly-thuyet"])) finalColors["ly-thuyet"] = data.customColors["ly-thuyet"];
            if (isSafeColor(data.customColors["thuc-hanh"])) finalColors["thuc-hanh"] = data.customColors["thuc-hanh"];
            if (isSafeColor(data.customColors["truc-tuyen"])) finalColors["truc-tuyen"] = data.customColors["truc-tuyen"];
            if (isSafeColor(data.customColors["thi"])) finalColors["thi"] = data.customColors["thi"];
            if (isSafeColor(data.customColors["tam-ngung"])) finalColors["tam-ngung"] = data.customColors["tam-ngung"];
        }

        colorLT.value = finalColors["ly-thuyet"];
        colorTH.value = finalColors["thuc-hanh"];
        colorTT.value = finalColors["truc-tuyen"];
        colorThi.value = finalColors["thi"];
        colorTN.value = finalColors["tam-ngung"];

        colorSelects.forEach(select => {
            previousColors[select.id] = select.value;
        });

        updateColorUI();
    });

    saveBtn.addEventListener('click', () => {
        const url = scriptUrlInput.value.trim();
        const user = userInp.value.trim();
        const pass = passInp.value.trim();

        if (!url || !user || !pass) {
            status.style.color = 'red';
            status.innerText = '❌ Thất bại: Vui lòng điền đầy đủ thông tin tài khoản và API trước khi lưu!';
            return;
        }

        const customColorsObj = {
            "ly-thuyet": colorLT.value,
            "thuc-hanh": colorTH.value,
            "truc-tuyen": colorTT.value,
            "thi": colorThi.value,
            "tam-ngung": colorTN.value
        };

        chrome.storage.sync.set({
            webAppUrl: url,
            iuhUser: user,
            iuhPass: pass,
            autoSyncEnabled: autoSyncToggle.checked,
            autoFillInfo: autoFillToggle.checked,
            autoCaptcha: autoCaptchaToggle.checked,
            autoClickLogin: autoClickToggle.checked,
            customColors: customColorsObj
        }, () => {
            status.style.color = '#0f9d58';
            status.innerText = '🚀 Hệ thống ghi nhận: Đã cập nhật và lưu cấu hình thành công!';
            setTimeout(() => { status.innerText = ''; }, 3000);
        });
    });

    const togglePassword = document.getElementById('togglePassword');
    const eyeIcon = document.getElementById('eyeIcon');
    const passInput = document.getElementById('password');

    if (togglePassword && passInput && eyeIcon) {
        togglePassword.addEventListener('click', function () {
            const isPassword = passInput.getAttribute('type') === 'password';
            passInput.setAttribute('type', isPassword ? 'text' : 'password');

            if (isPassword) {
                eyeIcon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>`;
                eyeIcon.setAttribute('stroke', '#0056b3');
                togglePassword.setAttribute('title', 'Ẩn mật khẩu');
            } else {
                eyeIcon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>`;
                eyeIcon.setAttribute('stroke', '#666');
                togglePassword.setAttribute('title', 'Hiện mật khẩu');
            }
        });
    }

    const btnStartSurvey = document.getElementById('btnStartSurvey');
    const surveyStatus = document.getElementById('survey-status');

    if (btnStartSurvey) {
        btnStartSurvey.addEventListener('click', async () => {
            surveyStatus.style.display = 'block';
            surveyStatus.textContent = 'Đang ghi nhận cờ hiệu hoạt động...';

            await chrome.storage.local.set({
                iuh_auto_survey_running: true,
                iuh_survey_current_index: 0,
                iuh_survey_urls: []
            });

            surveyStatus.textContent = 'Đang kiểm tra và điều hướng đến trang khảo sát...';

            chrome.tabs.query({ url: "*://sv.iuh.edu.vn/*" }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.update(tabs[0].id, {
                        url: "https://sv.iuh.edu.vn/sinh-vien/danh-sach-khao-sat.html",
                        active: true
                    });
                } else {
                    chrome.tabs.create({ url: "https://sv.iuh.edu.vn/sinh-vien/danh-sach-khao-sat.html" });
                }
            });
        });
    }
});