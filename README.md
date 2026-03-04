# Meesho Review Extractor

Chrome extension to scrape product reviews from Meesho product pages and export them to **CSV** or **TXT**.

## How to install

1. Open Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the folder: `Messho Review Extractor` (this project folder).
4. The extension icon will appear in the toolbar.

## How to use

1. Open a Meesho **product page** in Chrome (e.g. a URL like `https://www.meesho.com/.../p/...`).
2. Scroll down so the **Reviews** section is visible (and scroll within reviews if there is “Load more”).
3. Click the **Meesho Review Extractor** icon in the toolbar.
4. Click **Scrape reviews** in the popup.
5. When scraping finishes, use **Export CSV** or **Export TXT** to download the file.

## Export formats

- **CSV**: Columns `Rating`, `Review`, `Author`, `Date` — suitable for Excel/Sheets.
- **TXT**: Plain text with a header (product, URL, date) and each review in a simple block.

## Notes

- The scraper works on the **currently visible** DOM. If Meesho loads more reviews on scroll, scroll the reviews section first, then click **Scrape reviews** again to get more.
- If the site’s HTML structure changes, the selectors in `content.js` may need to be updated (e.g. new class names for review cards).

## Files

- `manifest.json` — Extension manifest (Manifest V3).
- `popup.html` / `popup.css` / `popup.js` — Popup UI and export logic.
- `content.js` — Injected on Meesho product pages; scrapes reviews and responds to “scrape” messages.
