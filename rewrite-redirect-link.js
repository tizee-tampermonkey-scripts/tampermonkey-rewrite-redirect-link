// ==UserScript==
// @name         Rewrite Redirect Links
// @namespace    https://github.com/tizee-tampermonkey-scripts/tampermonkey-rewrite-redirect-link
// @version      1.7.0
// @description  Rewrites redirect links to their target URLs directly, using a queue and a custom debounce function.
// @downloadURL  https://raw.githubusercontent.com/tizee-tampermonkey-scripts/tampermonkey-rewrite-redirect-link/main/rewrite-redirect-link.js
// @updateURL    https://raw.githubusercontent.com/tizee-tampermonkey-scripts/tampermonkey-rewrite-redirect-link/main/rewrite-redirect-link.js
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
    const MAX_EXPANSION_DEPTH = 3; // Prevent infinite recursion for nested short URLs
    const MAX_DISPLAY_LENGTH = 50; // Max length for displayed URLs

    // Queue to store links that need to be processed
    const linkQueue = new Set();
    let expandLinkApi = GM_getValue(resolverKey) || 'https://your-worker.workers.dev';

    // Configuration for different types of redirect/short links
    const redirectPatterns = [
        { domain: 'youtube.com', pattern: 'a[href*="youtube.com/redirect"]', isShortUrl: false },
        { domain: 'zhihu.com', pattern: 'a[href*="link.zhihu.com"]', isShortUrl: false },
        { domain: 'x.com', pattern: 'a[href*="t.co"]', isShortUrl: true }
    ];

    // Short URL services regex patterns
    const shortUrlPatterns = [
        { regex: /t\.co\/\w+/i, name: 't.co' },
        { regex: /bit\.ly\/\w+/i, name: 'bit.ly' }
    ];

    // Check if a URL is a short URL
    function isShortUrl(url) {
        return shortUrlPatterns.some(pattern => pattern.regex.test(url));
    }

    // Format URL for display (truncate if too long)
    function formatUrlForDisplay(url) {
        try {
            const urlObj = new URL(url);
            let displayUrl = urlObj.host + urlObj.pathname;
            if (displayUrl.length > MAX_DISPLAY_LENGTH) {
                displayUrl = displayUrl.substring(0, MAX_DISPLAY_LENGTH) + '...';
            }
            return displayUrl;
        } catch (e) {
            // If URL parsing fails, return original with truncation
            return url.length > MAX_DISPLAY_LENGTH ? url.substring(0, MAX_DISPLAY_LENGTH) + '...' : url;
        }
    }

    // Update the visible text content of a link
    function updateLinkText(link, originalUrl, expandedUrl) {
        // Find the short URL pattern in the link's text content
        const linkText = link.textContent;

        // Check if any short URL pattern exists in the text content
        for (const pattern of shortUrlPatterns) {
            if (pattern.regex.test(linkText)) {
                // Get the matched short URL text
                const match = linkText.match(pattern.regex);
                if (match && match[0]) {
                    const shortUrlText = match[0];
                    const displayUrl = formatUrlForDisplay(expandedUrl);

                    // If the link only contains the short URL, replace it completely
                    if (linkText.trim() === shortUrlText ||
                        linkText.trim() === 'https://' + shortUrlText ||
                        linkText.trim() === 'http://' + shortUrlText) {
                        link.textContent = displayUrl;
                    } else {
                        // Otherwise, replace just the short URL portion
                        // Handle links that might have protocol in a separate span
                        const childNodes = Array.from(link.childNodes);
                        let replaced = false;

                        // Look through text nodes and spans
                        for (const node of childNodes) {
                            if (node.nodeType === Node.TEXT_NODE && node.textContent.includes(shortUrlText)) {
                                node.textContent = node.textContent.replace(shortUrlText, displayUrl);
                                replaced = true;
                                break;
                            }
                        }

                        // If no replacement was made in child nodes, try the whole text
                        if (!replaced) {
                            link.textContent = linkText.replace(shortUrlText, displayUrl);
                        }
                    }
                    break;
                }
            }
        }
    }

    function expandShortLink(shortLink, depth, callback) {
        console.debug(`[short url][depth:${depth}] request ${expandLinkApi}`);
        GM_xmlhttpRequest({
            method: "GET",
            url: `${expandLinkApi}/?shorturl=${encodeURIComponent(shortLink)}`,
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    const data = JSON.parse(response.responseText);
                    const expandedURL = data.expanded_url || shortLink; // Fallback to the original shortLink
                    console.debug(`[short url][depth:${depth}] ${expandLinkApi}?shorturl=${encodeURIComponent(shortLink)} -> ${expandedURL}`);

                    // Check if the expanded URL is also a short URL and we haven't reached max depth
                    if (depth < MAX_EXPANSION_DEPTH && isShortUrl(expandedURL)) {
                        console.debug(`[short url][depth:${depth}] Found nested short URL, expanding further: ${expandedURL}`);
                        expandShortLink(expandedURL, depth + 1, callback);
                    } else {
                        callback(expandedURL);
                    }
                } else {
                    console.debug(`[short url][depth:${depth}] Failed to expand link:`, response.status, response.statusText);
                    callback(shortLink);
                }
            },
            onerror: function(error) {
                console.debug(`[short url][depth:${depth}] Error expanding link:`, error);
                callback(shortLink);
            }
        });
    }

    // Function to extract the target URL from a redirect URL
    function extractTargetUrl(redirectUrl, callback) {
        const url = new URL(redirectUrl);

        if (isShortUrl(redirectUrl)) {
            console.debug(`[short url] Detected short URL: ${redirectUrl}`);
            expandShortLink(redirectUrl, 0, callback);
        } else {
            const params = new URLSearchParams(url.search);
            const targetUrlEncoded = params.get('q') || params.get('target');
            if (targetUrlEncoded) {
                const decodedUrl = decodeURIComponent(targetUrlEncoded);

                // Check if the decoded URL is a short URL that needs further expansion
                if (isShortUrl(decodedUrl)) {
                    console.debug(`[redirect] Found short URL in redirect parameter: ${decodedUrl}`);
                    expandShortLink(decodedUrl, 0, callback);
                } else {
                    callback(decodedUrl);
                }
            } else {
                callback(null);
            }
        }
    }

    // Function to process a single link
    function processLink(link) {
        const originalUrl = link.href;
        extractTargetUrl(originalUrl, function(targetUrl) {
            if (targetUrl) {
                console.debug(`${originalUrl} -> ${targetUrl}`);
                link.href = targetUrl; // Rewrite the href to the target URL

                // Update the displayed text if it contains a short URL
                updateLinkText(link, originalUrl, targetUrl);
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

    // Function to scan for links in a domain
    function scanForLinksInDomain(node, domain) {
        // Find the pattern configuration for this domain
        const domainConfig = redirectPatterns.find(pattern =>
            new RegExp(`(^|\\.)${pattern.domain}$`).test(domain));

        if (!domainConfig) return;

        // Scan for links using the domain-specific pattern
        const links = node.querySelectorAll(domainConfig.pattern);

        // Additionally scan for known short URL patterns on all domains
        shortUrlPatterns.forEach(pattern => {
            const shortLinks = node.querySelectorAll(`a[href*="${pattern.name}"]`);
            shortLinks.forEach(link => {
                if (!linkQueue.has(link)) {
                    linkQueue.add(link);
                }
            });
        });

        links.forEach(link => {
            if (!linkQueue.has(link)) {
                linkQueue.add(link);
            }
        });

        debouncedProcessQueue();
    }

    // Function to scan for links and add them to the queue
    function scanForLinks(node) {
        scanForLinksInDomain(node, window.location.hostname);
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
