(function() {
    const extId = chrome.runtime.id;
    document.documentElement.setAttribute('data-iuh-ext-url', `chrome-extension://${extId}/`);
    document.documentElement.setAttribute('data-iuh-model-url', chrome.runtime.getURL('tfjs_model/model.json'));

    chrome.storage.sync.get(["autoCaptcha", "autoFillInfo", "autoClickLogin"], (data) => {
        document.documentElement.setAttribute('data-iuh-auto-captcha', data.autoCaptcha !== false);
        document.documentElement.setAttribute('data-iuh-auto-fill', data.autoFillInfo !== false);
        document.documentElement.setAttribute('data-iuh-auto-login', data.autoClickLogin !== false);
    });
})();   