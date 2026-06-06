// background.js
const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; 

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("weeklyClientSyncCheck", { periodInMinutes: 60 });
    console.log("[IUH Sync Background] Đã khởi tạo bộ hẹn giờ báo thức ngầm.");

    // TEST MODE: Tự động chạy sau 2 giây khi Reload Extension
    // setTimeout(() => {
    //     executeSyncProcess(true); 
    // }, 2000); 
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "weeklyClientSyncCheck") {
        executeSyncProcess(false);
    }
});

function executeSyncProcess(isTestMode = false) {
    chrome.storage.sync.get(['lastSyncTime', 'autoSyncEnabled'], (data) => {
        if (data.autoSyncEnabled === false) return;

        const now = Date.now();
        const lastSync = data.lastSyncTime || 0;

        if (isTestMode || (now - lastSync >= SYNC_INTERVAL_MS)) {
            console.log(`[IUH Sync Background] 🚀 Khởi chạy luồng cập nhật...`);
            
            // 1. ĐẶT CỜ HIỆU VÀO LOCAL STORAGE (Không bao giờ bị mất khi Web chuyển hướng)
            chrome.storage.local.set({ iuh_auto_sync_active: true }, () => {
                chrome.tabs.create({
                    // 2. MỞ THẲNG TRANG LỊCH HỌC! 
                    url: "https://sv.iuh.edu.vn/lich-theo-tuan.html",
                    active: false 
                }, (tab) => {
                    chrome.storage.local.set({ runningSyncTabId: tab.id });
                });
            });
        }
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "syncComplete") {
        chrome.storage.sync.set({ lastSyncTime: Date.now() });
        
        // 3. XÓA CỜ HIỆU KHI ĐÃ ĐỒNG BỘ XONG
        chrome.storage.local.remove('iuh_auto_sync_active');
        
        chrome.storage.local.get(['runningSyncTabId'], (data) => {
            if (data.runningSyncTabId) {
                chrome.tabs.remove(data.runningSyncTabId, () => {
                    chrome.storage.local.remove('runningSyncTabId');
                });
            }
        });
    }

    if (request.action === "manualSyncComplete") {
        chrome.storage.sync.set({ lastSyncTime: Date.now() });
    }
});