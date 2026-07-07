// background.js
const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; 

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("weeklyClientSyncCheck", { periodInMinutes: 20 });
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
            
            // 1. ĐẶT CỜ HIỆU VÀO LOCAL STORAGE
            chrome.storage.local.set({ iuh_auto_sync_active: true }, () => {
                chrome.tabs.create({
                    url: "https://sv.iuh.edu.vn/lich-theo-tuan.html",
                    active: false,   // 🟢 Không chiếm quyền tập trung, sinh viên vẫn lướt web khác bình thường
                    pinned: true     // 📌 GHIM TAB LẬP TỨC: Thu nhỏ về góc ngoài cùng bên trái thanh Tabbar
                }, (tab) => {
                    chrome.storage.local.set({ runningSyncTabId: tab.id });
                });
            });
        }
    });
}

// BỘ LẮNG NGHE TIN NHẮN    
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // --- LUỒNG XỬ LÝ LỊCH HỌC TỰ ĐỘNG ---
    if (request.action === "syncComplete") {
        chrome.storage.sync.set({ lastSyncTime: Date.now() });
        
        // Xóa cờ hiệu lịch học
        chrome.storage.local.remove('iuh_auto_sync_active');
        
        chrome.storage.local.get(['runningSyncTabId'], (data) => {
            const tabId = data.runningSyncTabId || (sender.tab ? sender.tab.id : null);
            if (tabId) {
                // ⚡ BỎ GHIM VÀ ĐÓNG TAB CỰC NHANH TRÁNH HIỆU ỨNG TRƯỢT
                chrome.tabs.update(tabId, { pinned: false }, () => {
                    chrome.tabs.remove(tabId, () => {
                        chrome.storage.local.remove('runningSyncTabId');
                    });
                });
            }
        });
    }

    if (request.action === "manualSyncComplete") {
        chrome.storage.sync.set({ lastSyncTime: Date.now() });
    }

    // --- LUỒNG XỬ LÝ KHẢO SÁT TỰ ĐỘNG (ĐÃ TÍCH HỢP TRƯỚC ĐÓ) ---
    if (request.action === "openAndPinSurveyTab") {
        chrome.tabs.create({ url: request.url, pinned: true, active: true }, (tab) => {
            sendResponse({ success: true, tabId: tab.id });
        });
        return true; 
    }

    if (request.action === "closeSurveyTab") {
        const tabId = sender.tab ? sender.tab.id : null;
        if (tabId) {
            chrome.tabs.update(tabId, { pinned: false }, () => {
                chrome.tabs.remove(tabId);
            });
        }
    }
});

// SỰ KIỆN CLICK ICON EXTENSION (NẰM NGOÀI CÙNG ĐỘC LẬP)
chrome.action.onClicked.addListener((tab) => {
    chrome.runtime.openOptionsPage();
});