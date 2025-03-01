async function expandShortLink(shortLink) {
  try {
    const response = await fetch(shortLink, {
      // prevent auto-redirect
      redirect: 'manual'
    });

    if (response.status >= 300 && response.status < 400) {
      // redirect
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

    try {
      const expandedLink = await expandShortLink(shortLink);
      return new Response(JSON.stringify({ expanded_url: expandedLink }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    } catch (error) {
      console.error("Error during short URL expansion:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  },
};
