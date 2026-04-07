// bridge.js
(function() {
    // 1. Lấy và gắn URL gốc của Extension (Dùng để load Model AI)
    const extId = chrome.runtime.id;
    const baseDir = `chrome-extension://${extId}/`;
    document.documentElement.setAttribute('data-iuh-ext-url', baseDir);

    // 2. Lấy trạng thái công tắc Bật/Tắt từ Popup và gắn lên HTML
    chrome.storage.sync.get(["autoCaptcha"], (data) => {
        // Mặc định là Bật (true) nếu người dùng chưa mở Popup lưu bao giờ
        const isAuto = data.autoCaptcha !== false; 
        document.documentElement.setAttribute('data-iuh-auto-captcha', isAuto);
    });

    console.log("[IUH Sync] 🌉 Đã thiết lập cầu nối dữ liệu (Kèm tín hiệu Công tắc).");
})();