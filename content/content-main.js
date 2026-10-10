// YouTube Timedtext Network Interceptor Hook
// Runs in world: MAIN at document_start to capture raw subtitle network responses

(function () {
  if (window.__ytSubHookInstalled) return;
  window.__ytSubHookInstalled = true;

  // 1. Hook window.fetch
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
      if (url && typeof url === 'string' && url.includes('/api/timedtext')) {
        const clone = res.clone();
        clone.text().then((text) => {
          if (text && text.trim().length > 0 && !text.startsWith('<!DOCTYPE html') && !text.startsWith('<html')) {
            window.postMessage({ type: 'YT_SUB_TIMEDTEXT_CAPTURED', url, text }, '*');
          }
        }).catch(() => {});
      }
    } catch (e) {}
    return res;
  };

  // 2. Hook XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._ytSubUrl = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    if (this._ytSubUrl && typeof this._ytSubUrl === 'string' && this._ytSubUrl.includes('/api/timedtext')) {
      this.addEventListener('load', () => {
        try {
          if (this.responseText && !this.responseText.startsWith('<!DOCTYPE html') && !this.responseText.startsWith('<html')) {
            window.postMessage({ type: 'YT_SUB_TIMEDTEXT_CAPTURED', url: this._ytSubUrl, text: this.responseText }, '*');
          }
        } catch (e) {}
      });
    }
    return origSend.apply(this, arguments);
  };
})();
