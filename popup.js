(function () {
  'use strict';

  let scrapedData = null;

  const scrapeBtn = document.getElementById('scrapeBtn');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const reviewCount = document.getElementById('reviewCount');
  const exportCsv = document.getElementById('exportCsv');
  const exportTxt = document.getElementById('exportTxt');

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.className = 'status' + (isError ? ' error' : ' success');
  }

  function escapeCsv(val) {
    if (val == null) return '';
    const s = String(val);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(data) {
    const headers = ['Rating', 'Review', 'Author', 'Date'];
    const rows = data.reviews.map((r) => [
      r.rating,
      r.text,
      r.author,
      r.date,
    ]);
    const lines = [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))];
    return lines.join('\r\n');
  }

  function toTxt(data) {
    const lines = data.reviews.map((r, i) => {
      const parts = [`--- Review ${i + 1} ---`];
      if (r.rating) parts.push(`Rating: ${r.rating}`);
      if (r.author) parts.push(`Author: ${r.author}`);
      if (r.date) parts.push(`Date: ${r.date}`);
      parts.push(r.text || '(no text)');
      return parts.join('\n');
    });
    const header = [
      `Meesho Review Export`,
      `Product: ${data.productTitle || 'N/A'}`,
      `URL: ${data.url || ''}`,
      `Scraped: ${data.scrapedAt || ''}`,
      `Total reviews: ${data.reviews.length}`,
      '',
    ].join('\n');
    return header + lines.join('\n\n');
  }

  function download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  scrapeBtn.addEventListener('click', async () => {
    scrapeBtn.disabled = true;
    setStatus('Scraping…');
    results.classList.add('hidden');
    scrapedData = null;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab.url.includes('meesho.com')) {
        setStatus('Open a Meesho product page first.', true);
        scrapeBtn.disabled = false;
        return;
      }

      // Inject content script so it's present (e.g. if tab was opened before extension load)
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });
      if (!response) {
        setStatus('No response. Reload the Meesho page and try again.', true);
        scrapeBtn.disabled = false;
        return;
      }
      if (!response.ok) {
        setStatus(response.error || 'Scrape failed.', true);
        scrapeBtn.disabled = false;
        return;
      }

      scrapedData = response.data;
      const count = scrapedData.reviews.length;
      reviewCount.textContent = count;
      results.classList.remove('hidden');
      exportCsv.disabled = exportTxt.disabled = count === 0;
      setStatus(count ? `Found ${count} reviews.` : 'No reviews found. Scroll the page and try again.');
    } catch (e) {
      setStatus('Error: ' + (e.message || 'Reload the Meesho page and try again.'), true);
      results.classList.add('hidden');
    }
    scrapeBtn.disabled = false;
  });

  exportCsv.addEventListener('click', () => {
    if (!scrapedData) return;
    const slug = (scrapedData.productTitle || 'meesho-reviews').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 50);
    const filename = `meesho-reviews-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    download(toCsv(scrapedData), filename, 'text/csv;charset=utf-8');
    setStatus('CSV downloaded.');
  });

  exportTxt.addEventListener('click', () => {
    if (!scrapedData) return;
    const slug = (scrapedData.productTitle || 'meesho-reviews').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 50);
    const filename = `meesho-reviews-${slug}-${new Date().toISOString().slice(0, 10)}.txt`;
    download(toTxt(scrapedData), filename, 'text/plain;charset=utf-8');
    setStatus('TXT downloaded.');
  });
})();
