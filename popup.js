let printTriggerCount = 0;

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

document.getElementById('scanBtn').onclick = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) {
      setStatus('Open the PLRA registry page first.');
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'COUNT_PRINTS' }, (res) => {
      if (chrome.runtime.lastError || !res) {
        setStatus('Scan failed - open the PLRA registry table page first.');
        return;
      }
      printTriggerCount = res.count;
      setStatus('Found ' + printTriggerCount + ' print row(s) on this page.');
    });
  });
};

document.getElementById('dlBtn').onclick = () => {
  if (printTriggerCount === 0) {
    setStatus('Scan the page first.');
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) {
      setStatus('Open the PLRA registry page first.');
      return;
    }
    chrome.runtime.sendMessage({ type: 'START_BULK', tabId: tab.id, total: printTriggerCount }, () => {
      chrome.tabs.sendMessage(tab.id, { type: 'RUN_BULK_PRINT' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) {
          setStatus('Could not start. Click Scan Page again, then retry.');
          return;
        }
        setStatus('Processing 0/' + res.total + ' - do not close this tab...');
      });
    });
  });
};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'PROGRESS') {
    setStatus('Downloaded ' + msg.completed + '/' + msg.total + ' PDF(s)...');
  }
  if (msg.type === 'BULK_CLICK_DONE') {
    setStatus('All ' + msg.total + ' rows clicked. Finishing downloads...');
  }
});
