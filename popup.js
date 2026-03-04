(function () {
  'use strict';

  const STORAGE_KEYS = { lastResult: 'meesho_lastResult', theme: 'meesho_theme' };

  let scrapedData = null;

  const scrapeBtn = document.getElementById('scrapeBtn');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const reviewCount = document.getElementById('reviewCount');
  const preview = document.getElementById('preview');
  const reminder = document.getElementById('reminder');
  const lastSavedLabel = document.getElementById('lastSavedLabel');
  const productTitleLabel = document.getElementById('productTitleLabel');
  const exportCsv = document.getElementById('exportCsv');
  const exportTxt = document.getElementById('exportTxt');
  const exportJson = document.getElementById('exportJson');
  const copyBtn = document.getElementById('copyBtn');
  const themeToggle = document.getElementById('themeToggle');

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

  function toJson(data) {
    return JSON.stringify(
      {
        productTitle: data.productTitle,
        url: data.url,
        scrapedAt: data.scrapedAt,
        reviewCount: data.reviews.length,
        reviews: data.reviews,
      },
      null,
      2
    );
  }

  function getSlug(data) {
    return (data.productTitle || 'meesho-reviews').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 50);
  }

  function updatePreview(data) {
    preview.innerHTML = '';
    if (!data || !data.reviews.length) return;
    const max = 3;
    data.reviews.slice(0, max).forEach((r, i) => {
      const t = (r.text || '').slice(0, 80) + (r.text && r.text.length > 80 ? '…' : '');
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.title = r.text || '';
      div.textContent = `${i + 1}. ${t}`;
      preview.appendChild(div);
    });
  }

  function renderResults(data, isFromStorage = false) {
    if (!data || !data.reviews) return;
    scrapedData = data;
    const count = data.reviews.length;
    const title = (data.productTitle || '').trim() || 'Unknown product';
    productTitleLabel.textContent = title;
    productTitleLabel.title = title;
    reviewCount.textContent = count;
    updatePreview(data);
    results.classList.remove('hidden');
    const noReviews = count === 0;
    exportCsv.disabled = exportTxt.disabled = exportJson.disabled = copyBtn.disabled = noReviews;
    if (isFromStorage && count > 0) {
      lastSavedLabel.textContent = '(saved)';
    } else {
      lastSavedLabel.textContent = '';
    }
  }

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isMeesho = tab?.url && tab.url.includes('meesho.com');
    if (!isMeesho) {
      reminder.classList.remove('hidden');
      scrapeBtn.disabled = true;
      scrapeBtn.title = 'Open a Meesho product page first';
    } else {
      reminder.classList.add('hidden');
      scrapeBtn.disabled = false;
      scrapeBtn.title = '';
    }

    const stored = await chrome.storage.local.get([STORAGE_KEYS.lastResult, STORAGE_KEYS.theme]);
    const lastResult = stored[STORAGE_KEYS.lastResult];
    const theme = stored[STORAGE_KEYS.theme];
    if (lastResult && lastResult.reviews && lastResult.reviews.length > 0) {
      renderResults(lastResult, true);
      setStatus('Last result loaded. Scrape again or export.');
    } else {
      setStatus('');
    }

    const themeValue = theme || 'light';
    document.body.setAttribute('data-theme', themeValue);
    themeToggle.textContent = themeValue === 'dark' ? '☀' : '🌙';
    themeToggle.title = themeValue === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
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
      updatePreview(scrapedData);
      results.classList.remove('hidden');
      lastSavedLabel.textContent = '';
      const noReviews = count === 0;
      exportCsv.disabled = exportTxt.disabled = exportJson.disabled = copyBtn.disabled = noReviews;
      setStatus(count ? `Found ${count} reviews.` : 'No reviews found. Scroll the page and try again.');
      if (count > 0) {
        await chrome.storage.local.set({ [STORAGE_KEYS.lastResult]: scrapedData });
      }
    } catch (e) {
      setStatus('Error: ' + (e.message || 'Reload the Meesho page and try again.'), true);
      results.classList.add('hidden');
    }
    scrapeBtn.disabled = false;
  });

  exportCsv.addEventListener('click', () => {
    if (!scrapedData) return;
    const filename = `meesho-reviews-${getSlug(scrapedData)}-${new Date().toISOString().slice(0, 10)}.csv`;
    download(toCsv(scrapedData), filename, 'text/csv;charset=utf-8');
    setStatus('CSV downloaded.');
  });

  exportTxt.addEventListener('click', () => {
    if (!scrapedData) return;
    const filename = `meesho-reviews-${getSlug(scrapedData)}-${new Date().toISOString().slice(0, 10)}.txt`;
    download(toTxt(scrapedData), filename, 'text/plain;charset=utf-8');
    setStatus('TXT downloaded.');
  });

  exportJson.addEventListener('click', () => {
    if (!scrapedData) return;
    const filename = `meesho-reviews-${getSlug(scrapedData)}-${new Date().toISOString().slice(0, 10)}.json`;
    download(toJson(scrapedData), filename, 'application/json;charset=utf-8');
    setStatus('JSON downloaded.');
  });

  copyBtn.addEventListener('click', async () => {
    if (!scrapedData) return;
    const format = 'csv';
    const text = format === 'csv' ? toCsv(scrapedData) : toTxt(scrapedData);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Copied to clipboard (CSV).');
    } catch (_) {
      setStatus('Could not copy.', true);
    }
  });

  themeToggle.addEventListener('click', async () => {
    const current = document.body.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    themeToggle.textContent = next === 'dark' ? '☀' : '🌙';
    themeToggle.title = next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    await chrome.storage.local.set({ [STORAGE_KEYS.theme]: next });
  });

  init();
})();
