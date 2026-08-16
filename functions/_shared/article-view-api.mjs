const PUBLIC_THRESHOLD = 100;
const DEDUPE_SECONDS = 86_400;
const MAX_SLUG_LENGTH = 96;
const MAX_BODY_BYTES = 1_024;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PUBLISHED_ARTICLE_SLUGS = new Set([
  "why-everything-seems-to-go-wrong-in-a-bad-mood",
  "the-invisible-push",
  "how-the-brain-makes-decisions",
  "how-to-stop-overthinking-a-decision",
  "sunk-cost-fallacy",
  "paradox-of-choice",
  "decision-fatigue",
  "planning-fallacy",
]);

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function isValidSlug(slug) {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(slug)
  );
}

function isValidVisitorId(visitorId) {
  return (
    typeof visitorId === "string" &&
    visitorId.length === 36 &&
    UUID_V4_PATTERN.test(visitorId)
  );
}

function publicCountPayload(slug, count) {
  return {
    ok: true,
    slug,
    count,
    public: count >= PUBLIC_THRESHOLD,
    threshold: PUBLIC_THRESHOLD,
  };
}

async function readCount(database, slug) {
  const row = await database
    .prepare(
      "SELECT view_count FROM article_view_counts WHERE article_slug = ?1"
    )
    .bind(slug)
    .first();

  const count = Number(row?.view_count ?? 0);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

async function hashVisitorId(slug, visitorId) {
  const bytes = new TextEncoder().encode(`${slug}:${visitorId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function parsePostBody(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return {
      error: jsonResponse(
        { ok: false, error: "Content-Type must be application/json." },
        415
      ),
    };
  }

  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return {
      error: jsonResponse(
        { ok: false, error: "Request body is too large." },
        413
      ),
    };
  }

  let text;
  try {
    text = await request.text();
  } catch {
    return {
      error: jsonResponse({ ok: false, error: "Unable to read request body." }, 400),
    };
  }

  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return {
      error: jsonResponse(
        { ok: false, error: "Request body is too large." },
        413
      ),
    };
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return {
      error: jsonResponse({ ok: false, error: "Invalid JSON body." }, 400),
    };
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !isValidVisitorId(payload.visitorId)
  ) {
    return {
      error: jsonResponse(
        { ok: false, error: "Invalid visitor identifier." },
        400
      ),
    };
  }

  return { visitorId: payload.visitorId };
}

function isSameOriginRequest(request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

async function attemptToCountView(database, slug, visitorId) {
  const now = Math.floor(Date.now() / 1_000);
  const cutoff = now - DEDUPE_SECONDS;
  const visitorHash = await hashVisitorId(slug, visitorId);

  await database
    .prepare(
      `INSERT OR IGNORE INTO article_view_dedupe
       (article_slug, visitor_hash, last_counted_at)
       VALUES (?1, ?2, 0)`
    )
    .bind(slug, visitorHash)
    .run();

  const dedupeUpdate = await database
    .prepare(
      `UPDATE article_view_dedupe
       SET last_counted_at = ?1
       WHERE article_slug = ?2
         AND visitor_hash = ?3
         AND last_counted_at <= ?4`
    )
    .bind(now, slug, visitorHash, cutoff)
    .run();

  const counted = Number(dedupeUpdate?.meta?.changes ?? 0) === 1;

  if (counted) {
    await database
      .prepare(
        `INSERT INTO article_view_counts
         (article_slug, view_count, updated_at)
         VALUES (?1, 1, ?2)
         ON CONFLICT(article_slug) DO UPDATE SET
           view_count = article_view_counts.view_count + 1,
           updated_at = excluded.updated_at`
      )
      .bind(slug, now)
      .run();
  }

  return { counted, count: await readCount(database, slug) };
}

export async function handleArticleViewRequest({ request, env, slug }) {
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed." },
      405,
      { Allow: "GET, POST" }
    );
  }

  if (!isValidSlug(slug)) {
    return jsonResponse({ ok: false, error: "Invalid article slug." }, 400);
  }

  if (!PUBLISHED_ARTICLE_SLUGS.has(slug)) {
    return jsonResponse({ ok: false, error: "Article not found." }, 404);
  }

  const database = env?.ARTICLE_VIEWS_DB;
  if (!database || typeof database.prepare !== "function") {
    return jsonResponse(
      { ok: false, error: "Article view service is temporarily unavailable." },
      503
    );
  }

  try {
    if (method === "GET") {
      return jsonResponse(publicCountPayload(slug, await readCount(database, slug)));
    }

    if (!isSameOriginRequest(request)) {
      return jsonResponse({ ok: false, error: "Cross-origin request denied." }, 403);
    }

    const parsedBody = await parsePostBody(request);
    if (parsedBody.error) {
      return parsedBody.error;
    }

    const result = await attemptToCountView(
      database,
      slug,
      parsedBody.visitorId
    );

    return jsonResponse({
      ...publicCountPayload(slug, result.count),
      counted: result.counted,
    });
  } catch {
    return jsonResponse(
      { ok: false, error: "Article view service is temporarily unavailable." },
      503
    );
  }
}
