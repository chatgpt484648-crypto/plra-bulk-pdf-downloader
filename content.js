function collectPdfUrls() {
  const raw = new Set();
  const pdfRegex = /\.pdf($|\?)/i;
  const kw = ['/download', '/pdf', '/report', '/print', '/document', '/file'];
  const textRegex = /download|pdf|report|ڈاؤن لوڈ|ڈاؤنلوڈ|رپورٹ/i;

  document.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    const resolved = a.href || '';
    if (pdfRegex.test(resolved) || pdfRegex.test(href)) raw.add(href || resolved);
    const lower = (href || resolved).toLowerCase();
    if (kw.some(k => lower.includes(k))) raw.add(href || resolved);
  });

  document.querySelectorAll('button, input, a').forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' && !['button', 'submit'].includes((el.type || '').toLowerCase())) return;
    const text = (el.innerText || el.textContent || el.value || '').trim();
    if (textRegex.test(text)) {
      if (tag === 'a' && el.getAttribute('href')) raw.add(el.getAttribute('href'));
      const oc = el.getAttribute('onclick') || '';
      if (oc) {
        const winMatch = oc.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/i);
        if (winMatch) {
          raw.add(winMatch[1]);
        } else {
          for (const m of oc.matchAll(/['"]([^'"]+)['"]/g)) {
            const v = m[1].trim();
            if (v && !['_blank', '_self', '_parent', '_top'].includes(v.toLowerCase())) raw.add(v);
          }
        }
      }
    }
  });

  // PLRA print icons: ANY element whose onclick opens ReportViewer.aspx / window.open,
  // even when it is an icon-only button with no visible text (patched for the PLRA flow).
  document.querySelectorAll('[onclick]').forEach(el => {
    const oc = el.getAttribute('onclick') || '';
    if (!/reportviewer\.aspx|window\.open/i.test(oc)) return;
    const winMatch = oc.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/i);
    if (winMatch) raw.add(winMatch[1]);
    const urlMatch = oc.match(/['"]([^'"]*ReportViewer\.aspx[^'"]*)['"]/i);
    if (urlMatch) raw.add(urlMatch[1]);
  });

  document.querySelectorAll('iframe[src]').forEach(f => {
    const src = f.getAttribute('src') || '';
    if (pdfRegex.test(src)) raw.add(src);
  });

  const urls = [];
  const seen = new Set();
  raw.forEach(u => {
    if (!u || typeof u !== 'string') return;
    const trimmed = u.trim();
    if (!trimmed || trimmed === '#' || trimmed.startsWith('#') || trimmed.startsWith('javascript:')) return;
    try {
      const abs = new URL(trimmed, location.origin).href;
      if (/^https?:\/\//i.test(abs) && !seen.has(abs)) {
        seen.add(abs);
        urls.push(abs);
      }
    } catch (_) {}
  });

  return urls;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'SCAN_PDFS') sendResponse({ urls: collectPdfUrls() });
  return true;
});

console.log('PLRA scanner: ' + collectPdfUrls().length + ' candidates');
