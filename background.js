// background.js
const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

let isSyncTabSpawning = false; // Cờ khóa chống mở 2 tab cùng lúc

// ==============================================================================
// 1. HỆ THỐNG HẸN GIỜ (ALARM) TỰ ĐỘNG CHẠY NGẦM ĐỊNH KỲ
// ==============================================================================
chrome.runtime.onInstalled.addListener(() => {
    // Cứ mỗi 60 phút hệ thống sẽ thức dậy kiểm tra 1 lần xem đã quá 7 ngày chưa
    chrome.alarms.create("weeklyClientSyncCheck", { periodInMinutes: 60 });
    console.log("[IUH Background] Đã khởi tạo bộ hẹn giờ tự động đồng bộ lịch.");
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "weeklyClientSyncCheck") {
        executePeriodicSync();
    }
});

function executePeriodicSync() {
    chrome.storage.sync.get(['lastSyncTime', 'autoSyncEnabled'], (data) => {
        // Nếu người dùng tắt tính năng đồng bộ tự động trong cài đặt thì hủy bỏ
        if (data.autoSyncEnabled === false) return;

        const now = Date.now();
        const lastSync = data.lastSyncTime || 0;

        // Nếu đã trôi qua 7 ngày kể từ lần đồng bộ cuối cùng
        if (now - lastSync >= SYNC_INTERVAL_MS) {
            if (isSyncTabSpawning) return;
            isSyncTabSpawning = true;
            
            console.log(`[IUH Background] 🚀 Đã đến hạn 7 ngày. Khởi chạy Ghost Tab cào lịch tự động...`);
            
            // Xóa tab kẹt nếu có
            chrome.storage.local.get(['runningSyncTabId'], (localData) => {
                if (localData.runningSyncTabId) {
                    chrome.tabs.remove(localData.runningSyncTabId, () => { const err = chrome.runtime.lastError; });
                }
                
                // Mở Ghost Tab chạy ngầm. 
                // Content.js sẽ tự động đọc số tuần (iuh_sync_weeks_count) lưu từ lần cuối bạn nhập ở UI
                chrome.storage.local.set({ iuh_auto_sync_active: true }, () => {
                    chrome.tabs.create({
                        url: "https://sv.iuh.edu.vn/lich-theo-tuan.html",
                        active: false, // 🟢 CHẠY NGẦM: Không chiếm màn hình người dùng
                        pinned: true   // 📌 CHẠY NGẦM: Ghim vào góc nhỏ
                    }, (tab) => {
                        chrome.storage.local.set({ runningSyncTabId: tab.id });
                        setTimeout(() => { isSyncTabSpawning = false; }, 2000);
                    });
                });
            });
        }
    });
}

// ==============================================================================
// 2. BỘ LẮNG NGHE TIN NHẮN TỪ DASHBOARD (ĐIỀU KHIỂN THỦ CÔNG & DỌN DẸP TAB)
// ==============================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // ĐÓNG GHOST TAB LỊCH HỌC (Áp dụng cho cả luồng tự động và thủ công)
    if (request.action === "syncComplete" || request.action === "manualSyncComplete") {
        console.log(`[IUH Background] Xử lý đóng Ghost Tab sau sự kiện: ${request.action}`);
        
        // Cập nhật lại mốc thời gian để 7 ngày sau Alarm mới kêu tiếp
        chrome.storage.sync.set({ lastSyncTime: Date.now() });
        chrome.storage.local.remove('iuh_auto_sync_active');
        
        chrome.storage.local.get(['runningSyncTabId'], (data) => {
            const tabId = data.runningSyncTabId || (sender.tab ? sender.tab.id : null);
            if (tabId) {
                chrome.tabs.update(tabId, { pinned: false }, () => {
                    chrome.tabs.remove(tabId, () => {
                        chrome.storage.local.remove('runningSyncTabId');
                        console.log("[IUH Background] ✅ Đã dọn dẹp Ghost Tab thành công.");
                    });
                });
            }
        });
    }

    // KÍCH HOẠT CÀO LỊCH HỌC TỪ DASHBOARD
    if (request.action === "triggerManualScheduleSync") {
        if (isSyncTabSpawning) return;
        isSyncTabSpawning = true;
        console.log("[IUH Background] 📅 Kích hoạt Ghost Tab đồng bộ lịch từ Dashboard.");

        chrome.storage.local.get(['runningSyncTabId'], (data) => {
            if (data.runningSyncTabId) {
                chrome.tabs.remove(data.runningSyncTabId, () => { const err = chrome.runtime.lastError; });
            }
            
            chrome.storage.local.set({ iuh_auto_sync_active: true }, () => {
                chrome.tabs.create({
                    url: "https://sv.iuh.edu.vn/lich-theo-tuan.html",
                    active: false,
                    pinned: true
                }, (tab) => {
                    chrome.storage.local.set({ runningSyncTabId: tab.id });
                    setTimeout(() => { isSyncTabSpawning = false; }, 2000);
                });
            });
        });
    }

    // LUỒNG KHẢO SÁT & AUTO-LOGIN GIỮ NGUYÊN BÊN DƯỚI...
    if (request.action === "triggerAutoSurvey") {
        chrome.tabs.create({ url: "https://sv.iuh.edu.vn/sinh-vien/danh-sach-khao-sat.html", active: false, pinned: true });
    }
    if (request.action === "openAndPinSurveyTab") {
        chrome.tabs.create({ url: request.url, pinned: true, active: true }, (tab) => { sendResponse({ success: true, tabId: tab.id }); });
        return true; 
    }
    if (request.action === "closeSurveyTab") {
        const tabId = sender.tab ? sender.tab.id : null;
        if (tabId) { chrome.tabs.update(tabId, { pinned: false }, () => { chrome.tabs.remove(tabId); }); }
    }
    if (request.action === "renewSessionViaGhostTab") {
        chrome.tabs.create({ url: "https://sv.iuh.edu.vn/home.html?auto_sync_mode=1", active: false, pinned: true }, (tab) => {
            const cookieCheckListener = (tabId, changeInfo, updatedTab) => {
                if (tabId === tab.id && changeInfo.status === 'complete' && updatedTab.url.includes('/home.html')) {
                    chrome.tabs.remove(tabId);
                    chrome.tabs.onUpdated.removeListener(cookieCheckListener);
                    chrome.runtime.sendMessage({ action: "sessionRenewedSuccessfully" });
                }
            };
            chrome.tabs.onUpdated.addListener(cookieCheckListener);
        });
    }
});

// Mở Dashboard khi Click Icon
chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/portal.html") });
});