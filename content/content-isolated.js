// YouTube English Subtitles - Isolated World Content Script
// Monitors video element state, handles seeking, and captures live subtitles

(function () {
  let activeVideoElement = null;
  let lastReportedTime = -1;
  let throttleTimer = null;
  let currentVideoId = getCurrentVideoId();

  function getCurrentVideoId() {
    try {
      const url = new URL(window.location.href);
      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/shorts/')[1].split('/')[0];
      }
      return url.searchParams.get('v') || '';
    } catch (e) {
      return '';
    }
  }

  function getVideoElement() {
    if (activeVideoElement && document.contains(activeVideoElement)) {
      return activeVideoElement;
    }
    const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (video) {
      attachVideoListeners(video);
      activeVideoElement = video;
    }
    return video;
  }

  function attachVideoListeners(video) {
    if (video.dataset.ytSubAttached) return;
    video.dataset.ytSubAttached = 'true';

    let lastReportedTime = -1;
    let syncInterval = null;

    const notifyTimeUpdate = () => {
      const now = video.currentTime;
      if (Math.abs(now - lastReportedTime) < 0.05) return;
      lastReportedTime = now;

      chrome.runtime.sendMessage({
        action: 'TIME_UPDATE',
        currentTime: now,
        duration: video.duration || 0,
        paused: video.paused,
        videoId: currentVideoId
      }).catch(() => {});
    };

    video.addEventListener('timeupdate', notifyTimeUpdate);

    const startSyncLoop = () => {
      notifyTimeUpdate();
      if (!syncInterval) {
        syncInterval = setInterval(() => {
          if (!video.paused) notifyTimeUpdate();
        }, 100);
      }
    };

    const stopSyncLoop = () => {
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
      notifyTimeUpdate();
    };

    video.addEventListener('play', () => {
      startSyncLoop();
      chrome.runtime.sendMessage({
        action: 'PLAY_STATE_CHANGE',
        paused: false,
        currentTime: video.currentTime
      }).catch(() => {});
    });

    video.addEventListener('pause', () => {
      stopSyncLoop();
      chrome.runtime.sendMessage({
        action: 'PLAY_STATE_CHANGE',
        paused: true,
        currentTime: video.currentTime
      }).catch(() => {});
    });

    video.addEventListener('seeked', () => {
      notifyTimeUpdate();
    });

    if (!video.paused) {
      startSyncLoop();
    }
  }

  // Observe on-screen captions as live fallback
  function setupLiveCaptionObserver() {
    let lastLiveText = '';

    const notifyLiveCaption = () => {
      const segments = document.querySelectorAll('.ytp-caption-segment');
      if (segments.length > 0) {
        const text = Array.from(segments).map((s) => s.textContent || '').join(' ').trim();
        const video = getVideoElement();
        if (text && text !== lastLiveText) {
          lastLiveText = text;
          chrome.runtime.sendMessage({
            action: 'LIVE_CAPTION_SEGMENT',
            text,
            time: video ? video.currentTime : 0
          }).catch(() => {});
        }
      }
    };

    const observer = new MutationObserver(notifyLiveCaption);
    const target = document.querySelector('.html5-video-player') || document.body;
    observer.observe(target, { childList: true, subtree: true, characterData: true });

    // Also check on video timeupdate
    const video = getVideoElement();
    if (video) {
      video.addEventListener('timeupdate', notifyLiveCaption);
    }
  }

  function setupUrlWatcher() {
    let lastUrl = window.location.href;

    const checkUrl = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        const newVideoId = getCurrentVideoId();
        if (newVideoId !== currentVideoId) {
          currentVideoId = newVideoId;
          lastReportedTime = -1;

          chrome.runtime.sendMessage({
            action: 'VIDEO_CHANGED',
            videoId: currentVideoId,
            url: currentUrl
          }).catch(() => {});
        }
      }
    };

    setInterval(checkUrl, 400);
  }

  // Extension commands
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const video = getVideoElement();

    switch (message.action) {
      case 'GET_PLAYBACK_STATE': {
        sendResponse({
          success: true,
          currentTime: video ? video.currentTime : 0,
          duration: video ? video.duration || 0 : 0,
          paused: video ? video.paused : true,
          videoId: currentVideoId
        });
        return false;
      }

      case 'GET_CURRENT_LIVE_CAPTION': {
        const segments = document.querySelectorAll('.ytp-caption-segment');
        const text = Array.from(segments).map((s) => s.textContent || '').join(' ').trim();
        sendResponse({
          success: true,
          text,
          time: video ? video.currentTime : 0
        });
        return false;
      }

      case 'ENABLE_CC': {
        const ccBtn = document.querySelector('.ytp-subtitles-button');
        if (ccBtn) {
          const isPressed = ccBtn.getAttribute('aria-pressed') === 'true';
          if (!isPressed) {
            ccBtn.click();
          }
          sendResponse({ success: true, enabled: true });
        } else {
          sendResponse({ success: false, error: 'CC button not found' });
        }
        return false;
      }

      case 'SEEK_TO': {
        if (video && typeof message.time === 'number') {
          video.currentTime = Math.max(0, message.time);
          if (message.play !== false && video.paused) {
            video.play().catch(() => {});
          }
          sendResponse({ success: true, currentTime: video.currentTime });
        } else {
          sendResponse({ success: false, error: 'Video element not found' });
        }
        return false;
      }

      case 'TOGGLE_PLAY': {
        if (video) {
          if (video.paused) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
          sendResponse({ success: true, paused: video.paused });
        } else {
          sendResponse({ success: false, error: 'Video element not found' });
        }
        return false;
      }

      case 'SKIP': {
        if (video && typeof message.seconds === 'number') {
          video.currentTime = Math.max(0, Math.min(video.duration || 99999, video.currentTime + message.seconds));
          sendResponse({ success: true, currentTime: video.currentTime });
        } else {
          sendResponse({ success: false });
        }
        return false;
      }

      default:
        return false;
    }
  });

  // Listen for timedtext responses intercepted in main world
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === 'YT_SUB_TIMEDTEXT_CAPTURED') {
      chrome.runtime.sendMessage({
        action: 'TIMEDTEXT_CAPTURED',
        url: event.data.url,
        text: event.data.text,
        videoId: currentVideoId
      }).catch(() => {});
    }
  });

  // Initialize
  getVideoElement();
  setupUrlWatcher();
  setupLiveCaptionObserver();
})();
