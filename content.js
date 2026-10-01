// Finds every row's "پرنٹ کریں / پرنٹ کیجیے" trigger in the PLRA registry
// table, and (on command) clicks each one in sequence with a delay, letting
// the site's own JS/postback open the report (the background worker catches
// the resulting tab and downloads it). This does NOT scrape static links,
// because on this site the processId is only generated at click time.

function getPrintColumnIndex(table) {
  const headerRow = table.querySelector('tr');
  if (!headerRow) return -1;
  const cells = Array.from(headerRow.children);
  for (let i = 0; i < cells.length; i++) {
    const t = (cells[i].innerText || cells[i].textContent || '').trim();
    if (/پرنٹ/.test(t) || /print/i.test(t)) return i;
  }
  return -1;
}

function findPrintTriggers() {
  const triggers = [];
  document.querySelectorAll('table').forEach((table) => {
    const colIdx = getPrintColumnIndex(table);
    if (colIdx === -1) return;
    const rows = table.querySelectorAll('tr');
    rows.forEach((row, i) => {
      if (i === 0) return; // header row
      const cell = row.children[colIdx];
      if (!cell) return;
      let el = cell.querySelector('a, button, i, span, [onclick], [role="button"]');
      if (!el) el = cell;
      triggers.push(el);
    });
  });
  if (triggers.length === 0) {
    document.querySelectorAll('[onclick]').forEach((el) => {
      const oc = el.getAttribute('onclick') || '';
      const title = el.getAttribute('title') || '';
      if (/print|پرنٹ|reportviewer/i.test(oc) || /print|پرنٹ/i.test(title)) triggers.push(el);
    });
  }
  return triggers;
}

let running = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'COUNT_PRINTS') {
    sendResponse({ count: findPrintTriggers().length });
    return;
  }
  if (msg && msg.type === 'RUN_BULK_PRINT') {
    if (running) {
      sendResponse({ ok: false, error: 'already running' });
      return;
    }
    const triggers = findPrintTriggers();
    running = true;
    sendResponse({ ok: true, total: triggers.length });
    (async () => {
      for (let i = 0; i < triggers.length; i++) {
        try {
          triggers[i].click();
        } catch (e) {}
        await new Promise((r) => setTimeout(r, 1300));
      }
      running = false;
      chrome.runtime.sendMessage({ type: 'BULK_CLICK_DONE', total: triggers.length }).catch(() => {});
    })();
    return;
  }
  return true;
});

console.log('PLRA content script ready: ' + findPrintTriggers().length + ' print trigger(s) found');
