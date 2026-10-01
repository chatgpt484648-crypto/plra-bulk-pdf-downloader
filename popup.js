let items = [];
const downloaded = new Set();

function getSeg(u) {
  try {
    const p = new URL(u).pathname.split('/').filter(Boolean);
    return p.length ? p[p.length - 1] : u;
  } catch (e) {
    const s = u.split('/').filter(Boolean);
    return s.length ? s[s.length - 1] : u;
  }
}

function buildName(url, i) {
  let base = getSeg(url).replace(/[^A-Za-z0-9._-]/g, '_');
  try {
    const u = new URL(url);
    const pid = u.searchParams.get('processId');
    if (pid) base = pid.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60);
  } catch (e) {}
  if (!/\.pdf$/i.test(base)) base += '.pdf';
  return 'plra_pdf_' + (i + 1) + '_' + base;
}

function render() {
  const listEl = document.getElementById('list');
  listEl.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('div');
    const label = document.createElement('label');
    label.title = item.url;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item.checked;
    cb.onchange = () => { item.checked = cb.checked; };
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + getSeg(item.url)));
    row.appendChild(label);
    listEl.appendChild(row);
  });
}

function activeTab(cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => cb(tabs && tabs[0] && tabs[0].id));
}

document.getElementById('scanBtn').onclick = () => {
  const status = document.getElementById('status');
  activeTab((tabId) => {
    if (!tabId) {
      status.textContent = 'Scan failed - open the PLRA site tab first';
      return;
    }
    chrome.tabs.sendMessage(tabId, { type: 'SCAN_PDFS' }, (res) => {
      if (chrome.runtime.lastError || !res || !Array.isArray(res.urls)) {
        status.textContent = 'Scan failed - open the PLRA site tab first';
        return;
      }
      items = res.urls.map((url) => ({ url, checked: true }));
      render();
      status.textContent = 'Found ' + items.length + ' PDF(s)';
    });
  });
};

document.getElementById('addBtn').onclick = () => {
  const input = document.getElementById('addUrl');
  const val = input.value.trim();
  if (val) {
    items.push({ url: val, checked: true });
    input.value = '';
    render();
  }
};

document.getElementById('dlBtn').onclick = async () => {
  const status = document.getElementById('status');
  const targets = items.filter((it) => it.checked && !downloaded.has(it.url));
  const total = targets.length;
  if (total === 0) {
    status.textContent = 'Done: 0 file(s)';
    return;
  }
  for (let k = 0; k < total; k++) {
    const item = targets[k];
    status.textContent = 'Downloading ' + (k + 1) + '/' + total + '...';
    await new Promise((r) => setTimeout(r, 700));
    chrome.downloads.download({ url: item.url, filename: buildName(item.url, k) });
    downloaded.add(item.url);
  }
  status.textContent = 'Done: ' + total + ' file(s)';
};

// Fallback for viewer pages that only produce the PDF when visited in a tab:
// opens each checked URL in a background tab so the site's own download flow runs.
document.getElementById('tabsBtn').onclick = async () => {
  const status = document.getElementById('status');
  const targets = items.filter((it) => it.checked && !downloaded.has(it.url));
  const total = targets.length;
  if (total === 0) {
    status.textContent = 'Nothing to open';
    return;
  }
  for (let k = 0; k < total; k++) {
    status.textContent = 'Opening ' + (k + 1) + '/' + total + '...';
    chrome.tabs.create({ url: targets[k].url, active: false });
    downloaded.add(targets[k].url);
    await new Promise((r) => setTimeout(r, 900));
  }
  status.textContent = 'Opened ' + total + ' tab(s)';
};
