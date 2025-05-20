/**
 * 追踪并展开短链接，对B站短链接进行特殊处理
 * @param {string} shortLink 需要展开的短链接
 * @param {number} maxRedirects 最大重定向次数限制，防止无限循环
 * @returns {string} 展开后的链接
 */
async function handleBilibili(url) {
  // 检查是否是B站链接
  if (!url.includes('bilibili') && !url.includes('b23.tv')) {
    return url;
  }

  try {
    // 如果是b23.tv短链接，首先进行展开
    if (url.includes('b23.tv')) {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.bilibili.com/'
      };

      let currentUrl = url;
      let redirectCount = 0;
      const maxRedirects = 5;

      while (redirectCount < maxRedirects) {
        const response = await fetch(currentUrl, {
          redirect: 'manual',
          headers: headers
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('Location');
          if (!location) {
            break;
          }
          currentUrl = new URL(location, currentUrl).href;
          redirectCount++;
        } else {
          break;
        }
      }

      // 更新URL为展开后的地址
      url = currentUrl;
    }

    // 现在清理B站URL
    return cleanBilibiliUrl(url);
  } catch (error) {
    console.error("处理B站链接时出错:", error);
    return url;
  }
}

async function expandShortLink(shortLink, maxRedirects = 5) {
  // 特殊处理B站短链接
  if (shortLink.includes('b23.tv')) {
    return await handleBilibili(shortLink);
  }

  try {
    const response = await fetch(shortLink, {
      redirect: 'manual' // 阻止自动重定向
    });
    console.log(response)
    if (response.status >= 300 && response.status < 400) {
      // 获取重定向位置
      const location = response.headers.get('Location');
      if (!location) {
        throw new Error("重定向URL未在响应头中找到");
      }
      console.error("get location", location);
      return location;
    } else if (response.ok) {
      return shortLink;
    } else {
      throw new Error(`HTTP错误! 状态码: ${response.status}`);
    }
  } catch (error) {
    console.error(`展开短链接时出错: ${error}`);
    throw error;
  }
}

/**
 * 清理哔哩哔哩URL，去除跟踪参数，只保留视频ID
 * @param {string} url B站完整URL
 * @returns {string} 清理后的URL
 */
function cleanBilibiliUrl(url) {
  try {
    // 匹配BV号的正则表达式(支持BV和av两种格式)
    const bvRegex = /\/video\/(BV\w+)/i;
    const avRegex = /\/video\/(av\d+)/i;

    let bvMatch = url.match(bvRegex);
    let avMatch = url.match(avRegex);

    if (bvMatch && bvMatch[1]) {
      // 返回干净的移动版URL
      return `https://www.bilibili.com/video/${bvMatch[1]}`;
    } else if (avMatch && avMatch[1]) {
      // 对于av号也做同样处理
      return `https://www.bilibili.com/video/${avMatch[1]}`;
    } else {
      // 无法直接从路径提取，尝试从URL参数中获取
      const urlObj = new URL(url);
      const bvid = urlObj.searchParams.get('bvid');
      const aid = urlObj.searchParams.get('aid');

      if (bvid) {
        return `https://www.bilibili.com/video/${bvid}`;
      } else if (aid) {
        return `https://www.bilibili.com/video/av${aid}`;
      } else {
        // 最后尝试从路径中任意位置匹配
        const lastResortBvRegex = /(BV\w{10})/i;
        const lastResortMatch = url.match(lastResortBvRegex);

        if (lastResortMatch && lastResortMatch[1]) {
          return `https://www.bilibili.com/video/${lastResortMatch[1]}`;
        }

        console.warn("无法从B站URL中提取视频ID:", url);
        return url;
      }
    }
  } catch (error) {
    console.error("清理B站URL时出错:", error);
    return url;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const shortLink = url.searchParams.get('shorturl');

    if (!shortLink) {
      return new Response("请提供'shorturl'参数。", {status: 400});
    }

    // 根据shortLink生成缓存键
    const cacheKey = `https://${url.hostname}/expand-shortlink?url=${encodeURIComponent(shortLink)}`;

    try {
      // 判断是否为缓存请求
      const skipCache = url.searchParams.get('nocache') === '1';

      if (!skipCache) {
        // 尝试使用缓存获取展开结果
        let response = await fetch(request, {
          cf: {
            // 缓存1小时(3600秒)
            cacheTtl: 3600,
            cacheEverything: true,
            // 自定义缓存键确保基于短URL缓存
            cacheKey: cacheKey
          }
        });

        // 如果命中缓存，返回缓存的响应
        const cacheStatus = response.headers.get('cf-cache-status');
        if (cacheStatus === 'HIT') {
          return response;
        }
      }

      // 未缓存时，执行展开操作
      const expandedLink = await expandShortLink(shortLink);

      // 创建带有适当缓存头的新响应
      let response = new Response(JSON.stringify({
        original_url: shortLink,
        expanded_url: expandedLink,
      }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          // 设置浏览器缓存30分钟
          'Cache-Control': 'max-age=1800'
        }
      });

      return response;
    } catch (error) {
      console.error("短URL展开过程中出错:", error);
      return new Response(JSON.stringify({error: error.message}), {
        status: 500,
        headers: {'Content-Type': 'application/json; charset=utf-8'},
      });
    }
  },
};
