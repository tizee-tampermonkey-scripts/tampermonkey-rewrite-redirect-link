# Rewrite-redirect-links

A Tempermonkey script for rewriting `<a>` redirect href links to its target url.

## Supported redirect links

- YouTube
- Zhihu
- X

## Cloudflare worker for short urls 

Deploy `cloudflare-worker.js` as a serverless cloudflare worker.

see [https://developers.cloudflare.com/workers/](https://developers.cloudflare.com/workers/)

## How it works

1. Initial Scan: When the page loads, the script scans the entire document for YouTube redirect links and adds them to the queue.
2. Queue Processing: The queue is processed periodically (debounced to 500ms) to rewrite the href attributes of the links.
3. Dynamic Content: The MutationObserver detects new content added to the DOM and ensures that any new YouTube redirect links are added to the queue.
4. Efficient Processing: Links are processed in batches, and the debouncing ensures that the script doesn't overwhelm the browser.

## Advantages

1. No Missed Links: The queue ensures that all links are processed, even if the observer is throttled.
2. Efficient: Debouncing prevents excessive DOM updates and improves performance.
3. Scalable: Works well on pages with frequent DOM updates or dynamically loaded content.
4. No External Dependencies: The script uses a custom debounce function, so no external libraries like Lodash are required.
