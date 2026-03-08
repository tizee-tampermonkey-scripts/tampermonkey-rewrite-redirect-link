// ==UserScript==
// @name         Rewrite Redirect Links
// @namespace    https://github.com/tizee-tampermonkey-scripts/tampermonkey-rewrite-redirect-link
// @version      1.8.0
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
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // --- Storage Keys ---
    const RESOLVER_KEY = "RESOLVER";
    const CUSTOM_PATTERNS_KEY = "CUSTOM_SHORT_URL_PATTERNS";

    const MAX_EXPANSION_DEPTH = 3;
    const MAX_DISPLAY_LENGTH = 50;

    // --- Settings ---
    let expandLinkApi = GM_getValue(RESOLVER_KEY) || 'https://your-worker.workers.dev';

    // Built-in patterns (always present, not removable)
    const BUILTIN_SHORT_URL_PATTERNS = [
        { regex: 't\\.co/\\w+', name: 't.co' },
        { regex: 'bit\\.ly/\\w+', name: 'bit.ly' },
        { regex: 'git\\.new/\\w+', name: 'git.new' },
        { regex: 's\\.ee/[-\\w]+', name: 's.ee' },
        { regex: 'b23\\.tv/\\w+', name: 'b23.tv'}
    ];

    function loadCustomPatterns() {
        const saved = GM_getValue(CUSTOM_PATTERNS_KEY);
        if (!saved) return [];
        try {
            const arr = JSON.parse(saved);
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    }

    function saveCustomPatterns(patterns) {
        GM_setValue(CUSTOM_PATTERNS_KEY, JSON.stringify(patterns));
    }

    let customPatterns = loadCustomPatterns();

    // Build the active regex list from built-in + custom
    function getShortUrlPatterns() {
        const all = [...BUILTIN_SHORT_URL_PATTERNS, ...customPatterns];
        return all.map(p => ({
            regex: new RegExp(p.regex, 'i'),
            name: p.name,
        }));
    }

    let shortUrlPatterns = getShortUrlPatterns();

    function refreshPatterns() {
        customPatterns = loadCustomPatterns();
        shortUrlPatterns = getShortUrlPatterns();
    }

    // Queue to store links that need to be processed
    const linkQueue = new Set();

    // Configuration for different types of redirect/short links
    const redirectPatterns = [
        { domain: 'youtube.com', pattern: 'a[href*="youtube.com/redirect"]', isShortUrl: false },
        { domain: 'zhihu.com', pattern: 'a[href*="link.zhihu.com"]', isShortUrl: false },
        { domain: 'x.com', pattern: 'a[href*="t.co"]', isShortUrl: true }
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
            return url.length > MAX_DISPLAY_LENGTH ? url.substring(0, MAX_DISPLAY_LENGTH) + '...' : url;
        }
    }

    // Update the visible text content of a link
    function updateLinkText(link, originalUrl, expandedUrl) {
        const linkText = link.textContent;

        for (const pattern of shortUrlPatterns) {
            if (pattern.regex.test(linkText)) {
                const match = linkText.match(pattern.regex);
                if (match && match[0]) {
                    const shortUrlText = match[0];
                    const displayUrl = formatUrlForDisplay(expandedUrl);

                    if (linkText.trim() === shortUrlText ||
                        linkText.trim() === 'https://' + shortUrlText ||
                        linkText.trim() === 'http://' + shortUrlText) {
                        link.textContent = displayUrl;
                    } else {
                        const childNodes = Array.from(link.childNodes);
                        let replaced = false;

                        for (const node of childNodes) {
                            if (node.nodeType === Node.TEXT_NODE && node.textContent.includes(shortUrlText)) {
                                node.textContent = node.textContent.replace(shortUrlText, displayUrl);
                                replaced = true;
                                break;
                            }
                        }

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
                    const expandedURL = data.expanded_url || shortLink;
                    console.debug(`[short url][depth:${depth}] ${shortLink} -> ${expandedURL}`);

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
                link.href = targetUrl;
                updateLinkText(link, originalUrl, targetUrl);
            }
        });
    }

    // Function to process all links in the queue
    function processQueue() {
        linkQueue.forEach(link => {
            processLink(link);
            linkQueue.delete(link);
        });
    }

    // Custom debounce function
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    // Debounced version of processQueue
    const debouncedProcessQueue = debounce(processQueue, 500);

    // Function to scan for links in a domain
    function scanForLinksInDomain(node, domain) {
        const domainConfig = redirectPatterns.find(pattern =>
            new RegExp(`(^|\\.)${pattern.domain}$`).test(domain));

        if (!domainConfig) return;

        const links = node.querySelectorAll(domainConfig.pattern);

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

    function scanForLinks(node) {
        scanForLinksInDomain(node, window.location.hostname);
    }

    // MutationObserver callback
    function mutationHandler(mutationList) {
        mutationList.forEach(mutationRecord => {
            mutationRecord.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    scanForLinks(node);
                }
            });
        });
    }

    // Initialize the script
    function main() {
        scanForLinks(document.body);
        const observer = new MutationObserver(mutationHandler);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // --- Settings Panel UI ---

    GM_addStyle(`
        #rrl-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            z-index: 99998;
            backdrop-filter: blur(4px);
        }

        #rrl-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 560px;
            max-width: 90vw;
            max-height: 80vh;
            background: #15202b;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            color: #f7f9f9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            animation: rrl-slide-in 0.2s ease-out;
        }

        @keyframes rrl-slide-in {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        #rrl-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }

        #rrl-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
        }

        #rrl-close {
            background: transparent;
            border: none;
            color: #e7e9ea;
            font-size: 20px;
            cursor: pointer;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            flex-shrink: 0;
        }

        #rrl-close:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        #rrl-body {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
        }

        /* --- Form elements --- */
        .rrl-group {
            margin-bottom: 24px;
        }

        .rrl-group:last-child {
            margin-bottom: 0;
        }

        .rrl-label {
            font-size: 14px;
            font-weight: 600;
            color: #e7e9ea;
            margin-bottom: 4px;
        }

        .rrl-desc {
            font-size: 12px;
            color: #71767b;
            margin-bottom: 10px;
        }

        .rrl-input {
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: #f7f9f9;
            padding: 10px 12px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
            font-family: "SF Mono", Monaco, Menlo, monospace;
        }

        .rrl-input:focus {
            border-color: #1d9bf0;
        }

        .rrl-input::placeholder {
            color: #71767b;
        }

        .rrl-divider {
            border: none;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            margin: 24px 0;
        }

        /* --- Pattern list --- */
        .rrl-pattern-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 10px;
        }

        .rrl-pattern-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 8px;
            font-size: 13px;
        }

        .rrl-pattern-item.builtin {
            opacity: 0.6;
        }

        .rrl-pattern-name {
            font-weight: 600;
            color: #e7e9ea;
            min-width: 60px;
        }

        .rrl-pattern-regex {
            flex: 1;
            color: #71767b;
            font-family: "SF Mono", Monaco, Menlo, monospace;
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .rrl-pattern-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.06);
            color: #71767b;
            flex-shrink: 0;
        }

        .rrl-pattern-delete {
            background: transparent;
            border: none;
            color: #71767b;
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 14px;
            transition: all 0.15s;
            flex-shrink: 0;
        }

        .rrl-pattern-delete:hover {
            color: #f4212e;
            background: rgba(244, 33, 46, 0.1);
        }

        /* --- Add pattern form --- */
        .rrl-add-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .rrl-add-input {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            color: #f7f9f9;
            padding: 8px 10px;
            font-size: 13px;
            outline: none;
            transition: border-color 0.2s;
            box-sizing: border-box;
        }

        .rrl-add-input:focus {
            border-color: #1d9bf0;
        }

        .rrl-add-input::placeholder {
            color: #71767b;
        }

        .rrl-add-input-name {
            width: 90px;
            flex-shrink: 0;
        }

        .rrl-add-input-regex {
            flex: 1;
            font-family: "SF Mono", Monaco, Menlo, monospace;
        }

        .rrl-error {
            font-size: 12px;
            color: #f4212e;
            margin-top: 6px;
            display: none;
        }

        .rrl-error.show {
            display: block;
        }

        /* --- Buttons --- */
        .rrl-btn {
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #e7e9ea;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }

        .rrl-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
        }

        .rrl-btn-primary {
            background: #1d9bf0;
            border-color: #1d9bf0;
            color: #fff;
        }

        .rrl-btn-primary:hover {
            background: #1a8cd8;
            border-color: #1a8cd8;
        }

        .rrl-btn-small {
            padding: 4px 10px;
            font-size: 12px;
        }

        #rrl-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 16px 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        }

        .rrl-toast {
            position: absolute;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(29, 155, 240, 0.9);
            color: #fff;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 13px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .rrl-toast.show {
            opacity: 1;
        }

    `);

    function showSettingsPanel() {
        const existing = document.getElementById('rrl-overlay');
        if (existing) existing.remove();

        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'rrl-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        // Panel
        const panel = document.createElement('div');
        panel.id = 'rrl-panel';

        // Toast
        const toast = document.createElement('div');
        toast.className = 'rrl-toast';

        function showToast(msg) {
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 1500);
        }

        // --- Header ---
        const header = document.createElement('div');
        header.id = 'rrl-header';

        const title = document.createElement('h3');
        title.textContent = 'Rewrite Redirect Links';

        const closeBtn = document.createElement('button');
        closeBtn.id = 'rrl-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => overlay.remove());

        header.appendChild(title);
        header.appendChild(closeBtn);

        // --- Body ---
        const body = document.createElement('div');
        body.id = 'rrl-body';

        // -- API URL --
        const apiGroup = document.createElement('div');
        apiGroup.className = 'rrl-group';

        const apiLabel = document.createElement('div');
        apiLabel.className = 'rrl-label';
        apiLabel.textContent = 'Resolver API URL';

        const apiDesc = document.createElement('div');
        apiDesc.className = 'rrl-desc';
        apiDesc.textContent = 'Cloudflare Worker endpoint that resolves short URLs. Called as: GET {url}/?shorturl={encoded_url}';

        const apiInput = document.createElement('input');
        apiInput.className = 'rrl-input';
        apiInput.type = 'text';
        apiInput.placeholder = 'https://your-worker.workers.dev';
        apiInput.value = expandLinkApi;

        apiGroup.appendChild(apiLabel);
        apiGroup.appendChild(apiDesc);
        apiGroup.appendChild(apiInput);

        // -- Divider --
        const divider1 = document.createElement('hr');
        divider1.className = 'rrl-divider';

        // -- Short URL Patterns --
        const patternsGroup = document.createElement('div');
        patternsGroup.className = 'rrl-group';

        const patternsLabel = document.createElement('div');
        patternsLabel.className = 'rrl-label';
        patternsLabel.textContent = 'Short URL Patterns';

        const patternsDesc = document.createElement('div');
        patternsDesc.className = 'rrl-desc';
        patternsDesc.textContent = 'Regex patterns to detect short URLs. Built-in patterns cannot be removed. Custom patterns are saved immediately when added/removed.';

        const patternList = document.createElement('div');
        patternList.className = 'rrl-pattern-list';

        // Working copy of custom patterns for this session
        let draftCustom = customPatterns.map(p => ({ ...p }));

        function renderPatterns() {
            patternList.innerHTML = '';

            // Built-in patterns
            for (const p of BUILTIN_SHORT_URL_PATTERNS) {
                const item = document.createElement('div');
                item.className = 'rrl-pattern-item builtin';

                const name = document.createElement('span');
                name.className = 'rrl-pattern-name';
                name.textContent = p.name;

                const regex = document.createElement('span');
                regex.className = 'rrl-pattern-regex';
                regex.textContent = p.regex;

                const badge = document.createElement('span');
                badge.className = 'rrl-pattern-badge';
                badge.textContent = 'built-in';

                item.appendChild(name);
                item.appendChild(regex);
                item.appendChild(badge);
                patternList.appendChild(item);
            }

            // Custom patterns
            for (let i = 0; i < draftCustom.length; i++) {
                const p = draftCustom[i];
                const item = document.createElement('div');
                item.className = 'rrl-pattern-item';

                const name = document.createElement('span');
                name.className = 'rrl-pattern-name';
                name.textContent = p.name;

                const regex = document.createElement('span');
                regex.className = 'rrl-pattern-regex';
                regex.textContent = p.regex;

                const badge = document.createElement('span');
                badge.className = 'rrl-pattern-badge';
                badge.textContent = 'custom';

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'rrl-pattern-delete';
                deleteBtn.innerHTML = '&times;';
                deleteBtn.title = 'Remove pattern';
                deleteBtn.addEventListener('click', () => {
                    draftCustom.splice(i, 1);
                    renderPatterns();
                });

                item.appendChild(name);
                item.appendChild(regex);
                item.appendChild(badge);
                item.appendChild(deleteBtn);
                patternList.appendChild(item);
            }
        }

        renderPatterns();

        // Add pattern form
        const addRow = document.createElement('div');
        addRow.className = 'rrl-add-row';

        const addNameInput = document.createElement('input');
        addNameInput.className = 'rrl-add-input rrl-add-input-name';
        addNameInput.type = 'text';
        addNameInput.placeholder = 'e.g. tinyurl.com';

        const addRegexInput = document.createElement('input');
        addRegexInput.className = 'rrl-add-input rrl-add-input-regex';
        addRegexInput.type = 'text';
        addRegexInput.placeholder = 'Regex, e.g. tinyurl\\.com/\\w+';

        const addBtn = document.createElement('button');
        addBtn.className = 'rrl-btn rrl-btn-small rrl-btn-primary';
        addBtn.textContent = 'Add';

        const addError = document.createElement('div');
        addError.className = 'rrl-error';

        addBtn.addEventListener('click', () => {
            const name = addNameInput.value.trim();
            const regex = addRegexInput.value.trim();
            addError.classList.remove('show');

            if (!name || !regex) {
                addError.textContent = 'Both name and regex are required.';
                addError.classList.add('show');
                return;
            }

            // Validate regex
            try {
                new RegExp(regex, 'i');
            } catch (e) {
                addError.textContent = `Invalid regex: ${e.message}`;
                addError.classList.add('show');
                return;
            }

            // Check for duplicate name
            const allNames = [...BUILTIN_SHORT_URL_PATTERNS, ...draftCustom].map(p => p.name);
            if (allNames.includes(name)) {
                addError.textContent = `Pattern "${name}" already exists.`;
                addError.classList.add('show');
                return;
            }

            draftCustom.push({ name, regex });
            addNameInput.value = '';
            addRegexInput.value = '';
            renderPatterns();
        });

        addRow.appendChild(addNameInput);
        addRow.appendChild(addRegexInput);
        addRow.appendChild(addBtn);

        patternsGroup.appendChild(patternsLabel);
        patternsGroup.appendChild(patternsDesc);
        patternsGroup.appendChild(patternList);
        patternsGroup.appendChild(addRow);
        patternsGroup.appendChild(addError);

        body.appendChild(apiGroup);
        body.appendChild(divider1);
        body.appendChild(patternsGroup);

        // --- Footer ---
        const footer = document.createElement('div');
        footer.id = 'rrl-footer';

        const resetBtn = document.createElement('button');
        resetBtn.className = 'rrl-btn';
        resetBtn.textContent = 'Reset to Defaults';
        resetBtn.addEventListener('click', () => {
            apiInput.value = 'https://your-worker.workers.dev';
            draftCustom = [];
            renderPatterns();
            showToast('Reset to defaults (save to apply)');
        });

        const saveBtn = document.createElement('button');
        saveBtn.className = 'rrl-btn rrl-btn-primary';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => {
            // Save API URL
            const newApi = apiInput.value.trim();
            if (newApi) {
                expandLinkApi = newApi;
                GM_setValue(RESOLVER_KEY, newApi);
            }

            // Save custom patterns
            saveCustomPatterns(draftCustom);
            refreshPatterns();

            showToast('Settings saved');
        });

        footer.appendChild(resetBtn);
        footer.appendChild(saveBtn);

        // --- Keyboard ---
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.removeEventListener('keydown', onKeyDown);
            }
        };
        document.addEventListener('keydown', onKeyDown);

        // --- Assemble ---
        panel.appendChild(header);
        panel.appendChild(body);
        panel.appendChild(footer);
        panel.appendChild(toast);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    // --- Menu Commands ---
    GM_registerMenuCommand("Settings", showSettingsPanel);

    // Run the script
    main();
})();
