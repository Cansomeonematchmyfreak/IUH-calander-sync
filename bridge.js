// bridge.js
(function() {
    const extId = chrome.runtime.id;
    document.documentElement.setAttribute('data-iuh-ext-url', `chrome-extension://${extId}/`);
    document.documentElement.setAttribute('data-iuh-model-url', chrome.runtime.getURL('tfjs_model/model.json'));

    // 1. Đọc cấu hình từ Sync Storage và dán lên web (Đã bổ sung lấy customColors)
    chrome.storage.sync.get(["webAppUrl", "autoCaptcha", "autoFillInfo", "autoClickLogin", "customColors"], (data) => {
        document.documentElement.setAttribute('data-iuh-webapp-url', data.webAppUrl || "");
        document.documentElement.setAttribute('data-iuh-auto-captcha', data.autoCaptcha !== false);
        document.documentElement.setAttribute('data-iuh-auto-fill', data.autoFillInfo !== false);
        document.documentElement.setAttribute('data-iuh-auto-login', data.autoClickLogin !== false);
        
        // 🎨 ĐẨY BẢNG MÀU TÙY CHỈNH LÊN DOM CHO CONTENT SCRIPT ĐỌC
        if (data.customColors) {
            document.documentElement.setAttribute('data-iuh-custom-colors', JSON.stringify(data.customColors));
        }
    });

    // 2. Đọc cờ hiệu Local Storage (Chế độ chạy ngầm) và dán lên web
    // Đã SỬA BUG: Thêm 'iuh_sync_weeks_count' vào mảng để lấy số tuần người dùng nhập
    chrome.storage.local.get(['iuh_auto_sync_active', 'iuh_sync_weeks_count'], (data) => {
        if (data.iuh_auto_sync_active) {
            document.documentElement.setAttribute('data-iuh-auto-sync-active', 'true');
        }
        
        // Dán số tuần lên DOM để content.js có thể đọc được
        if (data.iuh_sync_weeks_count) {
            document.documentElement.setAttribute('data-iuh-sync-weeks-count', data.iuh_sync_weeks_count.toString());
        }
    });

    // 3. Lắng nghe hiệu lệnh từ content.js (MAIN WORLD) để báo cho background.js 
    document.addEventListener('IuhSyncComplete', () => {
        chrome.runtime.sendMessage({ action: "syncComplete" });
    });
    
    document.addEventListener('IuhManualSyncComplete', () => {
        chrome.runtime.sendMessage({ action: "manualSyncComplete" });
    });
})();