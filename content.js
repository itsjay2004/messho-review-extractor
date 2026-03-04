/**
 * Meesho Review Extractor - Content Script
 * Scrapes only the actual review blocks from Meesho product pages.
 * Uses the exact DOM structure: RatingReviewDrawer / Product Ratings & Reviews section,
 * and blocks containing Comment__CommentText (not product suggestions).
 */

(function () {
  'use strict';

  function getText(el) {
    if (!el) return '';
    return (el.textContent || '').trim().replace(/\s+/g, ' ');
  }

  /** Get the reviews root: drawer (when open) or PDP "Product Ratings & Reviews" section */
  function getReviewsRoot() {
    // 1) "View all reviews" drawer content (exact class from inside-view-all-review.html)
    const drawer = document.querySelector('[class*="RatingReviewDrawer__StyledCard"]');
    if (drawer) return drawer;

    // 2) PDP section with "Product Ratings & Reviews" (from review-block.html)
    const h6 = Array.from(document.querySelectorAll('h6')).find(
      (el) => getText(el).indexOf('Product Ratings') !== -1 || getText(el).indexOf('Ratings & Reviews') !== -1
    );
    if (h6) {
      const section = h6.closest('[class*="krCeEM"]') || h6.parentElement;
      if (section) return section;
    }

    return null;
  }

  /**
   * Extract reviews only from blocks that contain Comment__CommentText (real review text).
   * Each review block is a div that has: author (.heJNlj), rating (span[label] / .jklcNf), date (.fTrqZg), and Comment__CommentText.
   */
  function extractMeeshoReviews() {
    const root = getReviewsRoot();
    if (!root) return [];

    // Only look at review text elements inside the reviews section (excludes product suggestions)
    const commentTextSelectors = [
      '[class*="Comment__CommentText-sc-1ju5q0e-3"]',
      '[class*="Comment__CommentText"]',
    ];

    let commentEls = [];
    for (const sel of commentTextSelectors) {
      try {
        commentEls = root.querySelectorAll(sel);
        if (commentEls.length > 0) break;
      } catch (_) {}
    }

    const reviews = [];
    const seenText = new Set();

    for (const commentEl of commentEls) {
      const text = getText(commentEl);
      if (!text || text.length < 2) continue;

      // Review block = parent of the FlexRow that wraps the comment (structure from your HTML)
      const flexRow = commentEl.closest('[class*="Comment__FlexRow"]');
      if (!flexRow || !flexRow.parentElement) continue;

      const block = flexRow.parentElement;

      // Author: span with heJNlj (demi, greyT1) in this block
      let author = '';
      const authorSpan = block.querySelector('[class*="heJNlj"]');
      if (authorSpan) author = getText(authorSpan);

      // Rating: span with numeric rating (label attribute or class jklcNf)
      let rating = '';
      const ratingSpan = block.querySelector('span[label]') || block.querySelector('[class*="jklcNf"]');
      if (ratingSpan) rating = getText(ratingSpan);

      // Date: "Posted on ..." in span with fTrqZg
      let date = '';
      const dateSpan = block.querySelector('[class*="fTrqZg"]');
      if (dateSpan) date = getText(dateSpan);

      // Dedupe by review text
      const key = text.slice(0, 150);
      if (seenText.has(key)) continue;
      seenText.add(key);

      reviews.push({
        rating: rating.trim(),
        text: text.trim(),
        author: author.trim(),
        date: date.trim(),
      });
    }

    return reviews;
  }

  function scrollReviewArea() {
    const root = getReviewsRoot();
    if (root && root.scrollHeight > root.clientHeight) {
      root.scrollTop = root.scrollHeight;
    }
    root && root.scrollIntoView({ behavior: 'smooth', block: 'end' });
    window.scrollTo(0, document.body.scrollHeight);
  }

  function doScrape() {
    scrollReviewArea();

    const reviews = extractMeeshoReviews();

    const h1 = document.querySelector('h1');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const productTitle =
      getText(h1) ||
      getText(document.querySelector('[class*="ProductTitle"]')) ||
      getText(document.querySelector('[class*="product-title"]')) ||
      (ogTitle ? (ogTitle.getAttribute('content') || '').trim() : '') ||
      document.title;
    return {
      url: window.location.href,
      productTitle: (productTitle || document.title).trim(),
      scrapedAt: new Date().toISOString(),
      reviews,
    };
  }

  window.MeeshoReviewExtractor = { scrape: doScrape };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'scrape') {
      try {
        const data = doScrape();
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    }
    return true;
  });
})();
