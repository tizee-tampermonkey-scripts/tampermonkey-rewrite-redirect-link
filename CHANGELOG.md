# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 🚀 Features

- 🤖 feat(rewrite-redirect-link): Bump version to 1.7.2 and add s.ee to short URL patterns 🚀

- Updated version from 1.7.1 to 1.7.2 in `rewrite-redirect-link.js` to support s.ee short links 🚀
- Added `s.ee` to the list of short URL patterns in `rewrite-redirect-link.js` to handle links like https://s.ee/cf-ios 🕸️

Summary: Now we can rewrite those pesky s.ee links too! 🎉

- 🤖 feat(rewrite-redirect-link): Bump version to 1.7.1 and add git.new to short URL patterns 🚀

- Updated version from 1.7.0 to 1.7.1 in `rewrite-redirect-link.js` because we're moving fast and breaking things 💥
- Added `git.new` to the list of short URL patterns in `rewrite-redirect-link.js` because apparently, we needed more ways to shorten URLs 🤷‍♂️

Summary: Now we can rewrite those pesky git.new links too! 🎉
- 🤖 feat(rewrite-redirect-link): Major overhaul of URL rewriting logic 🚀

- Updated version to 1.7.0 🎉
- Added support for multiple redirect patterns (YouTube, Zhihu, X.com) 🕸️
- Implemented nested URL expansion with MAX_EXPANSION_DEPTH to prevent infinite recursion 🛑
- Added URL display formatting with MAX_DISPLAY_LENGTH for cleaner UI ✨
- Enhanced link text updating logic to handle various URL display scenarios 🎨
- Added support for multiple short URL services (t.co, bit.ly) 🔗
- Improved error handling and debugging messages 🐛
- Added configuration for different types of redirect/short links 🗂️
- Optimized link scanning with domain-specific patterns 🎯
- Added mutation observer for dynamically added content 🔍

This commit is like giving the script a PhD in URL manipulation 🎓 Now it can handle URLs like a boss 💪 and won't get stuck in infinite loops 🔄 (probably) 🤞
- 🤖 feat(README.md, cloudflare-worker.js): Added X support and Cloudflare Worker for URL expansion 🚀✨

- **README.md**: Added "X" to the list of supported platforms and introduced a new section about deploying `cloudflare-worker.js` as a serverless Cloudflare Worker. 📝🔥
- **cloudflare-worker.js**: Created a new file with a Cloudflare Worker script that expands short URLs and returns the expanded URL in JSON format. 🛠️🌐💻

Summary: This commit brings in X support and a shiny new Cloudflare Worker to handle short URL expansion like a boss! 🎉🚀
- 🤖 feat(rewrite-redirect-link.js): Added X.com support and URL expansion feature 🌐✨

- **Version bump**: 1.4 → 1.5 🚀
- **New match**: Added `*://*.x.com/*` to the @match list 🎯
- **New grant**: Added `GM_xmlhttpRequest` to handle API requests 🔄
- **New feature**: Added `expandShortLink` function to expand short URLs using an external API 🕵️‍♂️
- **New logic**: Added `isShortUrl` flag to differentiate between YouTube/Zhihu and X.com links 🏷️
- **Enhanced URL extraction**: Modified `extractTargetUrl` to handle both regular redirects and short URLs 🎛️
- **New hostname check**: Added `xRegex` to detect X.com URLs 🕵️
- **Debug logs**: Added more debug logs for better troubleshooting 🐛

Summary: Now supports X.com and expands short URLs like a boss! 💪🔥
- 🤖 feat(README): Added Zhihu to supported redirect links 🎉

- Updated `README.md` to include Zhihu in the list of supported redirect links 🚀
- Now you can skip those annoying Zhihu redirects too! 🎊

Summary: Added Zhihu to the list of supported redirect links in the README.
- 🤖 feat(rewrite-redirect-link.js): Add support for Zhihu redirect links and improve URL extraction

- Added support for Zhihu redirect links (`link.zhihu.com`) 🎉
- Updated `@match` to include `*://*.zhihu.com/*` 🌐
- Improved `extractTargetUrl` to handle both YouTube and Zhihu URL parameters (`q` and `target`) 🛠️
- Added hostname-based link detection logic for YouTube and Zhihu 🕵️‍♂️
- Added debug logging for better troubleshooting 🐛
- Bumped version to `1.4` 🚀

Summary: Now this script can handle both YouTube AND Zhihu redirect links like a boss! 💪🔥
- 🤖 feat: Added README and rewrite-redirect-link.js for YouTube redirect link rewriting

- 📄 `README.md`: Added documentation explaining the script's functionality, advantages, and how it works.
- 🛠️ `rewrite-redirect-link.js`: Created a Tampermonkey script to rewrite YouTube redirect links to their target URLs. Features include:
  - Queue-based processing for efficiency 🚀
  - Custom debounce function to prevent DOM overload 🛑
  - MutationObserver for dynamic content handling 🔄
  - No external dependencies 💪

Now YouTube redirect links will be rewritten like a boss! 🎥✨

### 🐛 Bug Fixes

- 🤖 fix(rewrite-redirect-link): Bump version to 1.6.5 and fix API URL formatting 🛠️

- Updated script version from 1.6.4 to 1.6.5 🚀
- Fixed the `expandLinkApi` URL formatting by separating the base URL and query parameters 🧩
- Added debug logging for short URL requests to make debugging easier 🐛
- Improved console log messages with `[short url]` prefix for better readability 📝

Changes in `rewrite-redirect-link.js`:
- Version bump 🆙
- API URL formatting fix 🔧
- Debug logging improvements 🕵️‍♂️
- Console message enhancements ✨

### 💼 Other

- Chore(version): Bump version to 1.6.3 and fix resolver prompt logic 🚀

- Updated script version from 1.6.2 to 1.6.3 in `rewrite-redirect-link.js` because we're moving fast! 🏎️
- Fixed a bug in the resolver prompt logic where it was checking `token` instead of `resolver`. Now it actually saves the resolver API like it's supposed to. 🐛➡️✅

Time to make those YouTube redirects even smoother! 🎥✨
- Chore[rewrite-redirect-link.js]: 🚀 Bump version to 1.6.2 and update expandLinkApi URL 🛠️

- Updated the script version from 1.6.1 to 1.6.2 to reflect changes. 📈
- Changed the default `expandLinkApi` URL from 'https://shorturl-expand.pobomp.workers.dev/?shorturl=' to 'https://your-worker.workers.dev/?shorturl=' for better clarity and maintenance. 🔄

This change ensures the script is up-to-date and uses a more generic URL for the expand link API. 🌐
- Chore(rewrite-redirect-link.js): 🔄 Update version and fix repo URLs 🛠️

- Bumped version from `1.6` to `1.6.1` 🚀
- Fixed `downloadURL` and `updateURL` to point to the correct repository path (changed from `tempermonkey-redirect-link` to `tempermonkey-rewrite-redirect-link`) 🔧

📜 Now the script knows where it truly belongs! 🏠

### ⚙️ Miscellaneous Tasks

- 🤖 chore(rewrite-redirect-link): Update namespace, version, and URLs 🚀

- Updated the namespace to `https://github.com/tizee-tampermonkey-scripts/tampermonkey-rewrite-redirect-link` because apparently, we're rebranding like it's 2024 🎉
- Bumped the version to `1.6.4` because why not? 🚀
- Updated `downloadURL` and `updateURL` to match the new namespace because consistency is key 🔑
- No functional changes, just some housekeeping 🧹✨
- 🤖 chore(rewrite-reddit-link): Remove debug console.log 🧹

- Removed `console.debug(window.location.hostname);` from `rewrite-redirect-link.js` because we don't need that shit cluttering up the console anymore. 🚮
- Cleaned up the code like a boss. 💪

Summary: No more debug spam, just pure, clean code. 🧼✨

<!-- generated by git-cliff -->
