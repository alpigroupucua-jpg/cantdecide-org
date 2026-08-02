# One-time Cloudflare Pages setup for article views

The repository contains the Pages Function, D1 migration, and API-only
`_routes.json`. The GitHub-connected Cloudflare Pages project still needs its
own D1 database and binding unless they have already been configured.

1. In Cloudflare, create a D1 database named `cantdecide-article-views`.
2. Apply `migrations/0001_article_view_counter.sql` to that remote database.
   With Wrangler authentication, the equivalent command is:
   `npx wrangler d1 migrations apply cantdecide-article-views --remote --migrations-dir migrations`
3. Open **Workers & Pages** and select the CantDecide.org Pages project.
4. Open **Settings**, then **Bindings**.
5. Add a D1 database binding with the variable name
   `ARTICLE_VIEWS_DB`.
6. Select the `cantdecide-article-views` database and save.
7. Redeploy the current `main` branch so the new binding is available.
8. Confirm that
   `GET /api/views/the-invisible-push` returns a JSON response.
9. Open a published article normally, keep the tab visible for five seconds,
   and confirm that the request succeeds. Do not seed or manually inflate
   counts while testing.

The counter is a best-effort public metric, not a verified unique-human count.
Readers can clear browser storage, and automated actors can attempt to create
new identifiers. The implementation deliberately avoids cookies, IP storage,
user-agent storage, and fingerprinting. Private Cloudflare Web Analytics
remains the authoritative internal analytics source.
