async function expandShortLink(shortLink) {
  try {
    const response = await fetch(shortLink, {
      redirect: 'manual' // 阻止自动重定向
    });

    if (response.status >= 300 && response.status < 400) {
      // 重定向
      const location = response.headers.get('Location');
      if (location) {
        return location;
      } else {
        throw new Error("Redirect URL not found in headers.");
      }
    } else if (response.ok) {
      // No redirect, return original URL
      return shortLink;
    } else {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error expanding short link: ${error}`);
    throw error;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const shortLink = url.searchParams.get('shorturl');

    if (!shortLink) {
      return new Response("Please provide a 'shorturl' parameter.", { status: 400 });
    }

    // Generate a cache key based on the shortLink
    const cacheKey = `https://${url.hostname}/expand-shortlink?url=${encodeURIComponent(shortLink)}`;

    try {
      // Try to fetch the expansion with caching
      let response = await fetch(request, {
        cf: {
          // Cache for 1 hour (3600 seconds)
          cacheTtl: 3600,
          cacheEverything: true,
          // Custom cache key to ensure we're caching based on the short URL
          cacheKey: cacheKey
        }
      });

      // If we have a cache hit, return the cached response
      const cacheStatus = response.headers.get('cf-cache-status');
      if (cacheStatus === 'HIT') {
        return response;
      }

      // If not cached, perform the expansion
      const expandedLink = await expandShortLink(shortLink);

      // Create a new response with proper cache headers
      response = new Response(JSON.stringify({ expanded_url: expandedLink }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          // Set browser cache for 30 minutes
          'Cache-Control': 'max-age=1800'
        }
      });

      return response;
    } catch (error) {
      console.error("Error during short URL expansion:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  },
};
