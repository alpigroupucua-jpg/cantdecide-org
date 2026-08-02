import { handleArticleViewRequest } from "./article-view-api.mjs";

function articleSlugFromPath(pathname) {
  const prefix = "/api/views/";
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const encodedSlug = pathname.slice(prefix.length);
  if (!encodedSlug || encodedSlug.includes("/")) {
    return "";
  }

  try {
    return decodeURIComponent(encodedSlug);
  } catch {
    return "";
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const articleSlug = articleSlugFromPath(url.pathname);

    if (articleSlug !== null) {
      return handleArticleViewRequest({
        request,
        env,
        slug: articleSlug,
      });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }

    const notFoundUrl = new URL("/404.html", request.url);
    return env.ASSETS.fetch(new Request(notFoundUrl, request));
  },
};
