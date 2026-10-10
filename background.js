// YouTube English Subtitles - Background Service Worker

// Enable side panel to open on action button click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('Failed to set side panel behavior:', err));

// Fallback action click listener in case setPanelBehavior isn't available or fails
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (err) {
      console.error('Failed to open side panel:', err);
    }
  }
});

// Broadcast tab changes so sidepanel can seamlessly switch context
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url && tab.url.includes('youtube.com')) {
      chrome.runtime.sendMessage({
        action: 'ACTIVE_TAB_CHANGED',
        tabId: tab.id,
        url: tab.url
      }).catch(() => {
        // Sidepanel might not be open, safe to ignore
      });
    }
  } catch (err) {
    // Tab might have closed
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com')) {
    chrome.runtime.sendMessage({
      action: 'TAB_URL_UPDATED',
      tabId: tabId,
      url: tab.url
    }).catch(() => {
      // Sidepanel might not be open, safe to ignore
    });
  }
});
