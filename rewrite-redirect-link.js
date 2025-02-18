// ==UserScript==
// @name         Rewrite Redirect Links
// @namespace    https://github.com/tizee/tempermonkey-rewrite-redirect-link
// @version      1.6.3
// @description  Rewrites YouTube redirect links to their target URLs directly, using a queue and a custom debounce function.
// @downloadURL  https://raw.githubusercontent.com/tizee/tempermonkey-rewrite-redirect-link/main/rewrite-redirect-link.js
// @updateURL    https://raw.githubusercontent.com/tizee/tempermonkey-rewrite-redirect-link/main/rewrite-redirect-link.js
// @author       tizee
// @match        *://*.youtube.com/*
// @match        *://*.zhihu.com/*
// @match        *://*.x.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';
    const resolverKey = "RESOLVER";

    // Queue to store links that need to be processed
    const linkQueue = new Set();
    let isShortUrl = false;
    let expandLinkApi = GM_getValue(resolverKey) || 'https://your-worker.workers.dev/?shorturl=';

    function expandShortLink(shortLink, callback) {
        GM_xmlhttpRequest({
            method: "GET",
            url: `${expandLinkApi}${encodeURIComponent(shortLink)}`,
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    const data = JSON.parse(response.responseText);
                    const expandedURL = data.expanded_url || shortLink; // Fallback to the original shortLink if finalUrl is not available.
                    console.debug(`${expandLinkApi}${encodeURIComponent(shortLink)} -> ${expandedURL}`);
                    callback(expandedURL);
                } else {
                    console.debug("Failed to expand link:", response.status, response.statusText);
                    callback(shortLink);
                }
            },
            onerror: function(error) {
                console.debug("Error expanding link:", error);
                callback(shortLink);
            }
        });
    }
    // Function to extract the target URL from a YouTube redirect URL
    function extractTargetUrl(redirectUrl, callback) {
        const url = new URL(redirectUrl);
        if (!isShortUrl) {
            const params = new URLSearchParams(url.search);
            const targetUrlEncoded = params.get('q') || params.get('target');
            if (targetUrlEncoded) {
                callback(decodeURIComponent(targetUrlEncoded));
            }
        }
        else {
            console.debug(`short url: ${redirectUrl}`);
            expandShortLink(redirectUrl, callback);
        }
        return null;
    }


    // Function to process a single link
    function processLink(link) {
        extractTargetUrl(link.href, function(targetUrl) {
            console.debug(`${link} ${targetUrl}`);
            if (targetUrl) {
                console.debug(`${link.href} -> ${targetUrl}`);
                link.href = targetUrl; // Rewrite the href to the target URL
            }
        });
    }

    // Function to process all links in the queue
    function processQueue() {
        linkQueue.forEach(link => {
            processLink(link);
            linkQueue.delete(link); // Remove the processed link from the queue
        });
    }

    // Custom debounce function
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId); // Clear the previous timeout
            timeoutId = setTimeout(() => {
                func.apply(this, args); // Call the function after the delay
            }, delay);
        };
    }

    // Debounced version of processQueue
    const debouncedProcessQueue = debounce(processQueue, 500); // Debounce to 500ms

    // Function to scan for new links and add them to the queue
    function scanForLinks(node) {
        let searchPattern = '';

        // Regular expressions for different hostnames
        const youtubeRegex = /(^|\.)youtube\.com$/;
        const zhihuRegex = /(^|\.)zhihu\.com$/;
        const xRegex = /(^|\.)x\.com$/;

        if (youtubeRegex.test(window.location.hostname)) {
            // youtube
            searchPattern = 'a[href*="youtube.com/redirect"]';
            isShortUrl = false;
        } else if (zhihuRegex.test(window.location.hostname)) {
            // zhihu
            searchPattern = 'a[href*="link.zhihu.com"]';
            isShortUrl = false;
        } else if (xRegex.test(window.location.hostname)) {
            searchPattern = 'a[href*="t.co"]';
            isShortUrl = true;
        }

        const links = node.querySelectorAll(searchPattern);
        links.forEach(link => {
            if (!linkQueue.has(link)) {
                linkQueue.add(link); // Add the link to the queue
            }
        });
        debouncedProcessQueue(); // Trigger the debounced queue processing
    }

    // MutationObserver callback to handle dynamically added content
    function mutationHandler(mutationList) {
        mutationList.forEach(mutationRecord => {
            mutationRecord.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    scanForLinks(node); // Scan for links in the new node
                }
            });
        });
    }

    // Initialize the script
    function main() {
        // Scan for links on the initial page load
        scanForLinks(document.body);

        // Observe DOM changes to handle dynamically loaded content
        const observer = new MutationObserver(mutationHandler);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Register menu command for api
    GM_registerMenuCommand("Set short url resovler API", () => {
      const resolver = prompt("Enter your short url resolver:");
      if (resolver) {
        GM_setValue(resolverKey, resolver);
        expandLinkApi = resolver;
        alert("url saved successfully!");
      }
    });
    // Run the script
    main();
})();
