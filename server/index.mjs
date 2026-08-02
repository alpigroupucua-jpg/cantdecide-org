import { handleArticleViewRequest } from "./article-view-api.mjs";

const LEGACY_DECISION_SCIENCE_PATHS = new Set([
  "/know-yourself",
  "/know-yourself/",
  "/know-yourself.html",
]);

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

    if (LEGACY_DECISION_SCIENCE_PATHS.has(url.pathname)) {
      const redirectUrl = new URL("/decision-science/", request.url);
      redirectUrl.search = url.search;
      return Response.redirect(redirectUrl, 301);
    }

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
