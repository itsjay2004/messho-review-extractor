# Meesho Review Extractor

Chrome extension to scrape product reviews from Meesho product pages and export them to **CSV**, **TXT**, or **JSON**. Includes logo, review preview, and copy-to-clipboard.

## How to install

1. Place **logo.png** in this folder (used for the extension icon and popup header).
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder: `Messho Review Extractor` (this project folder).
5. The extension icon (your logo) will appear in the toolbar.

## How to use

1. Open a Meesho **product page** in Chrome (e.g. a URL like `https://www.meesho.com/.../p/...`).
2. Scroll down so the **Reviews** section is visible (and scroll within reviews if there is “Load more”).
3. Click the **Meesho Review Extractor** icon in the toolbar.
4. Click **Scrape reviews** in the popup.
5. Use **Export** (CSV / TXT / JSON) or **Copy to clipboard** to save the data.

## Features

- **Logo** — Your `logo.png` is used as the toolbar icon and in the popup header.
- **Review preview** — First 3 reviews shown in the popup after scraping.
- **Export CSV** — Columns: Rating, Review, Author, Date (for Excel/Sheets).
- **Export TXT** — Plain text with product info and one block per review.
- **Export JSON** — Full structured data (productTitle, url, scrapedAt, reviews array).
- **Copy to clipboard** — Copies all reviews as CSV for pasting into a spreadsheet.

## Export formats

- **CSV**: Columns `Rating`, `Review`, `Author`, `Date` — suitable for Excel/Sheets.
- **TXT**: Plain text with a header (product, URL, date) and each review in a simple block.
- **JSON**: Structured object with metadata and `reviews` array.

## Notes

- The scraper works on the **currently visible** DOM. If Meesho loads more reviews on scroll, scroll the reviews section first, then click **Scrape reviews** again to get more.
- If the site’s HTML structure changes, the selectors in `content.js` may need to be updated (e.g. new class names for review cards).

## Files

- `manifest.json` — Extension manifest (Manifest V3).
- `popup.html` / `popup.css` / `popup.js` — Popup UI and export logic.
- `content.js` — Injected on Meesho product pages; scrapes reviews and responds to “scrape” messages.
