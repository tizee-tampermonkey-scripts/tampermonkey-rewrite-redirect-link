// ==UserScript==
// @name         Rewrite Redirect Links
// @namespace    https://github.com/tizee/tempermonkey-rewrite-redirect-link
// @version      1.4
// @description  Rewrites YouTube redirect links to their target URLs directly, using a queue and a custom debounce function.
// @author       tizee
// @match        *://*.youtube.com/*
// @match        *://*.zhihu.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Queue to store links that need to be processed
  const linkQueue = new Set();

  // Function to extract the target URL from a YouTube redirect URL
  function extractTargetUrl(redirectUrl) {
    const url = new URL(redirectUrl);
    const params = new URLSearchParams(url.search);
    const targetUrlEncoded = params.get('q') || params.get('target');
    if (targetUrlEncoded) {
      return decodeURIComponent(targetUrlEncoded);
    }
    return null;
  }

  // Function to process a single link
  function processLink(link) {
    const targetUrl = extractTargetUrl(link.href);
    console.debug(`${link} ${targetUrl}`);
    if (targetUrl) {
      console.debug(`${link.href} -> ${targetUrl}`);
      link.href = targetUrl; // Rewrite the href to the target URL
    }
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
    console.debug(window.location.hostname);

    // Regular expressions for different hostnames
    const youtubeRegex = /(^|\.)youtube\.com$/;
    const zhihuRegex = /(^|\.)zhihu\.com$/;

    if (youtubeRegex.test(window.location.hostname)) {
      // youtube
      searchPattern = 'a[href*="youtube.com/redirect"]';
    } else if (zhihuRegex.test(window.location.hostname)) {
      // zhihu
      searchPattern = 'a[href*="link.zhihu.com"]';
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

  // Run the script
  main();
})();
