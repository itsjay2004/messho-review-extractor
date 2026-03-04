(function () {
  'use strict';

  const STORAGE_KEYS = { lastResult: 'meesho_lastResult', theme: 'meesho_theme' };

  let scrapedData = null;

  const scrapeBtn        = document.getElementById('scrapeBtn');
  const scrapeLabel      = scrapeBtn.querySelector('.scrape-label');
  const statusEl         = document.getElementById('status');
  const results          = document.getElementById('results');
  const reviewCount      = document.getElementById('reviewCount');
  const preview          = document.getElementById('preview');
  const reminder         = document.getElementById('reminder');
  const lastSavedLabel   = document.getElementById('lastSavedLabel');
  const productTitleLabel= document.getElementById('productTitleLabel');
  const exportCsv        = document.getElementById('exportCsv');
  const exportTxt        = document.getElementById('exportTxt');
  const exportJson       = document.getElementById('exportJson');
  const copyBtn          = document.getElementById('copyBtn');
  const themeToggle      = document.getElementById('themeToggle');

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  function setStatus(message, type = '') {
    statusEl.textContent = message;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderStars(rating) {
    const num = Math.min(5, Math.max(0, Math.round(parseFloat(rating) || 0)));
    return '★'.repeat(num) + '☆'.repeat(5 - num);
  }

  function escapeCsv(val) {
    if (val == null) return '';
    const s = String(val);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(data) {
    const headers = ['Rating', 'Review', 'Author', 'Date'];
    const rows = data.reviews.map((r) => [r.rating, r.text, r.author, r.date]);
    const lines = [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))];
    return lines.join('\r\n');
  }

  function toTxt(data) {
    const lines = data.reviews.map((r, i) => {
      const parts = [`--- Review ${i + 1} ---`];
      if (r.rating) parts.push(`Rating: ${r.rating}`);
      if (r.author) parts.push(`Author: ${r.author}`);
      if (r.date)   parts.push(`Date: ${r.date}`);
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
    return (data.productTitle || 'meesho-reviews')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
  }

  /* ── Preview cards ────────────────────────────────────────────────────── */

  function updatePreview(data) {
    preview.innerHTML = '';
    if (!data || !data.reviews.length) {
      const empty = document.createElement('div');
      empty.className = 'preview-empty';
      empty.textContent = 'No reviews found on this page.';
      preview.appendChild(empty);
      return;
    }

    const MAX_PREVIEW = 5;
    data.reviews.slice(0, MAX_PREVIEW).forEach((r) => {
      const card = document.createElement('div');
      card.className = 'review-card';
      card.innerHTML =
        '<div class="review-header">' +
          '<span class="review-stars">' + renderStars(r.rating) + '</span>' +
          '<span class="review-author">' + escapeHtml(r.author || 'Anonymous') + '</span>' +
        '</div>' +
        '<div class="review-text">' + escapeHtml(r.text || '') + '</div>';
      preview.appendChild(card);
    });
  }

  /* ── Render full results ─────────────────────────────────────────────── */

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
      lastSavedLabel.classList.remove('hidden');
    } else {
      lastSavedLabel.classList.add('hidden');
    }
  }

  /* ── Loading state helpers ───────────────────────────────────────────── */

  function setLoading(loading) {
    scrapeBtn.disabled = loading;
    if (loading) {
      scrapeBtn.classList.add('loading');
      scrapeLabel.textContent = 'Scraping…';
    } else {
      scrapeBtn.classList.remove('loading');
      scrapeLabel.textContent = 'Scrape Reviews';
    }
  }

  /* ── Download helper ─────────────────────────────────────────────────── */

  function download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Theme ───────────────────────────────────────────────────────────── */

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀' : '🌙';
    themeToggle.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  }

  /* ── Init ────────────────────────────────────────────────────────────── */

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
    const theme = stored[STORAGE_KEYS.theme] || 'light';

    applyTheme(theme);

    if (lastResult && lastResult.reviews && lastResult.reviews.length > 0) {
      renderResults(lastResult, true);
      setStatus('Last result loaded — scrape again or export.', '');
    }
  }

  /* ── Scrape ──────────────────────────────────────────────────────────── */

  scrapeBtn.addEventListener('click', async () => {
    setLoading(true);
    setStatus('Scraping reviews…');
    results.classList.add('hidden');
    scrapedData = null;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab.url.includes('meesho.com')) {
        setStatus('Open a Meesho product page first.', 'error');
        setLoading(false);
        return;
      }

      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });
      if (!response) {
        setStatus('No response — reload the page and try again.', 'error');
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setStatus(response.error || 'Scrape failed.', 'error');
        setLoading(false);
        return;
      }

      scrapedData = response.data;
      const count = scrapedData.reviews.length;
      reviewCount.textContent = count;
      updatePreview(scrapedData);
      results.classList.remove('hidden');
      lastSavedLabel.classList.add('hidden');

      const noReviews = count === 0;
      exportCsv.disabled = exportTxt.disabled = exportJson.disabled = copyBtn.disabled = noReviews;

      if (count > 0) {
        setStatus(`Found ${count} review${count !== 1 ? 's' : ''}.`, 'success');
        await chrome.storage.local.set({ [STORAGE_KEYS.lastResult]: scrapedData });
      } else {
        setStatus('No reviews found — scroll the page and try again.', '');
      }
    } catch (e) {
      setStatus('Error: ' + (e.message || 'Reload the page and try again.'), 'error');
      results.classList.add('hidden');
    }

    setLoading(false);
  });

  /* ── Export actions ──────────────────────────────────────────────────── */

  exportCsv.addEventListener('click', () => {
    if (!scrapedData) return;
    const filename = `meesho-reviews-${getSlug(scrapedData)}-${new Date().toISOString().slice(0, 10)}.csv`;
    download(toCsv(scrapedData), filename, 'text/csv;charset=utf-8');
    setStatus('CSV downloaded.', 'success');
  });

  exportTxt.addEventListener('click', () => {
    if (!scrapedData) return;
    const filename = `meesho-reviews-${getSlug(scrapedData)}-${new Date().toISOString().slice(0, 10)}.txt`;
    download(toTxt(scrapedData), filename, 'text/plain;charset=utf-8');
    setStatus('TXT downloaded.', 'success');
  });

  exportJson.addEventListener('click', () => {
    if (!scrapedData) return;
    const filename = `meesho-reviews-${getSlug(scrapedData)}-${new Date().toISOString().slice(0, 10)}.json`;
    download(toJson(scrapedData), filename, 'application/json;charset=utf-8');
    setStatus('JSON downloaded.', 'success');
  });

  copyBtn.addEventListener('click', async () => {
    if (!scrapedData) return;
    try {
      await navigator.clipboard.writeText(toCsv(scrapedData));
      setStatus('Copied to clipboard.', 'success');
    } catch (_) {
      setStatus('Could not copy.', 'error');
    }
  });

  /* ── Theme toggle ────────────────────────────────────────────────────── */

  themeToggle.addEventListener('click', async () => {
    const current = document.body.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    await chrome.storage.local.set({ [STORAGE_KEYS.theme]: next });
  });

  init();
})();
