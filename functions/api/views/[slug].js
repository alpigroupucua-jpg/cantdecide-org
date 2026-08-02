import { handleArticleViewRequest } from "../../_shared/article-view-api.mjs";

export function onRequest(context) {
  return handleArticleViewRequest({
    request: context.request,
    env: context.env,
    slug: context.params.slug,
  });
}
