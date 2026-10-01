// Background service worker: watches for new tabs opened by the PLRA print
// buttons (window.open or postback-driven navigation), grabs the final
// ReportViewer.aspx URL (unique processId per row), downloads the PDF via
// chrome.downloads, then closes the extra tab. This works no matter HOW the
// site opens the report (window.open, target=_blank, __doPostBack), because
// it reacts to the resulting tab/navigation instead of guessing the mechanism.

let plraTabId = null;
let bulkActive = false;
const openedChildren = new Map(); // tabId -> { done: boolean }
let completedCount = 0;
let totalExpected = 0;

function buildFilename(url, idx) {
  let pid = 'pdf';
  try {
    const u = new URL(url);
    pid = u.searchParams.get('processId') || u.pathname.split('/').pop() || 'pdf';
  } catch (e) {}
  pid = decodeURIComponent(pid).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60);
  return 'plra_pdf_' + idx + '_' + pid + '.pdf';
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'START_BULK') {
    plraTabId = msg.tabId;
    bulkActive = true;
    completedCount = 0;
    totalExpected = msg.total || 0;
    openedChildren.clear();
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === 'STOP_BULK') {
    bulkActive = false;
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === 'GET_PROGRESS') {
    sendResponse({ completed: completedCount, total: totalExpected });
    return;
  }
  return true;
});

chrome.tabs.onCreated.addListener((tab) => {
  if (!bulkActive) return;
  if (tab.openerTabId !== plraTabId) return;
  openedChildren.set(tab.id, { done: false });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!bulkActive) return;
  if (!openedChildren.has(tabId)) return;
  const url = changeInfo.url || tab.url || '';
  if (!url) return;
  const entry = openedChildren.get(tabId);
  if (entry.done) return;
  if (/ReportViewer\.aspx/i.test(url) || /\.pdf($|\?)/i.test(url)) {
    entry.done = true;
    completedCount++;
    const filename = buildFilename(url, completedCount);
    chrome.downloads.download({ url, filename }, () => {});
    chrome.tabs.remove(tabId).catch(() => {});
    chrome.runtime.sendMessage({ type: 'PROGRESS', completed: completedCount, total: totalExpected }).catch(() => {});
  }
});
