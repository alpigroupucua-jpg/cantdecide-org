import assert from "node:assert/strict";
import test from "node:test";

import {
  handleArticleViewRequest,
  PUBLISHED_ARTICLE_SLUGS,
} from "../functions/_shared/article-view-api.mjs";
import {
  formatViewCount,
  getOrCreateVisitorState,
  updateVisibleCount,
  waitForVisibleDuration,
} from "../assets/js/article-views.mjs";
import worker from "../server/index.mjs";

const ARTICLE_SLUG = "the-invisible-push";
const ANALYSIS_PARALYSIS_SLUG = "how-to-stop-overthinking-a-decision";
const FIRST_VISITOR = "d9428888-122b-4a9f-8f61-21c9f3a6f11d";
const SECOND_VISITOR = "a8098c1a-f86e-4f9d-9bb4-74f7d36b3536";

class MockD1 {
  constructor() {
    this.counts = new Map();
    this.dedupe = new Map();
  }

  prepare(sql) {
    const database = this;
    return {
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async first() {
        if (!sql.includes("SELECT view_count")) {
          throw new Error("Unexpected first() query");
        }
        const count = database.counts.get(this.values[0]);
        return count === undefined ? null : { view_count: count };
      },
      async run() {
        if (sql.includes("INSERT OR IGNORE INTO article_view_dedupe")) {
          const [slug, visitorHash] = this.values;
          const key = `${slug}:${visitorHash}`;
          if (database.dedupe.has(key)) {
            return { meta: { changes: 0 } };
          }
          database.dedupe.set(key, 0);
          return { meta: { changes: 1 } };
        }

        if (sql.includes("UPDATE article_view_dedupe")) {
          const [now, slug, visitorHash, cutoff] = this.values;
          const key = `${slug}:${visitorHash}`;
          const previous = database.dedupe.get(key);
          if (previous === undefined || previous > cutoff) {
            return { meta: { changes: 0 } };
          }
          database.dedupe.set(key, now);
          return { meta: { changes: 1 } };
        }

        if (sql.includes("INSERT INTO article_view_counts")) {
          const [slug] = this.values;
          database.counts.set(slug, (database.counts.get(slug) || 0) + 1);
          return { meta: { changes: 1 } };
        }

        throw new Error("Unexpected run() query");
      },
    };
  }
}

function request(method, body, headers = {}) {
  const init = { method, headers };
  if (body !== undefined) {
    init.body = body;
  }
  return new Request(`https://cantdecide.org/api/views/${ARTICLE_SLUG}`, init);
}

async function callApi(database, method, body, headers, slug = ARTICLE_SLUG) {
  return handleArticleViewRequest({
    request: request(method, body, headers),
    env: database ? { ARTICLE_VIEWS_DB: database } : {},
    slug,
  });
}

async function json(response) {
  return { status: response.status, body: await response.json() };
}

test("GET returns zero and keeps the count private when no row exists", async () => {
  const result = await json(await callApi(new MockD1(), "GET"));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    ok: true,
    slug: ARTICLE_SLUG,
    count: 0,
    public: false,
    threshold: 100,
  });
});

test("the analysis paralysis article is accepted as published", async () => {
  assert.equal(PUBLISHED_ARTICLE_SLUGS.has(ANALYSIS_PARALYSIS_SLUG), true);
  const result = await json(
    await callApi(
      new MockD1(),
      "GET",
      undefined,
      undefined,
      ANALYSIS_PARALYSIS_SLUG
    )
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.slug, ANALYSIS_PARALYSIS_SLUG);
});

test("POST counts once per token during the deduplication period", async () => {
  const database = new MockD1();
  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify({ visitorId: FIRST_VISITOR });

  const first = await json(await callApi(database, "POST", body, headers));
  const repeated = await json(await callApi(database, "POST", body, headers));
  const different = await json(
    await callApi(
      database,
      "POST",
      JSON.stringify({ visitorId: SECOND_VISITOR }),
      headers
    )
  );

  assert.equal(first.body.counted, true);
  assert.equal(first.body.count, 1);
  assert.equal(repeated.body.counted, false);
  assert.equal(repeated.body.count, 1);
  assert.equal(different.body.counted, true);
  assert.equal(different.body.count, 2);
});

test("the same token may count after its server timestamp is older than 24 hours", async () => {
  const database = new MockD1();
  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify({ visitorId: FIRST_VISITOR });

  await callApi(database, "POST", body, headers);
  for (const key of database.dedupe.keys()) {
    database.dedupe.set(key, Math.floor(Date.now() / 1_000) - 86_401);
  }

  const result = await json(await callApi(database, "POST", body, headers));
  assert.equal(result.body.counted, true);
  assert.equal(result.body.count, 2);
});

test("invalid inputs, methods, and missing bindings fail safely", async () => {
  const database = new MockD1();
  const jsonHeaders = { "Content-Type": "application/json" };

  assert.equal(
    (await callApi(database, "GET", undefined, undefined, "../attack")).status,
    400
  );
  assert.equal(
    (
      await callApi(
        database,
        "POST",
        "{not-json",
        jsonHeaders
      )
    ).status,
    400
  );
  assert.equal(
    (
      await callApi(
        database,
        "POST",
        JSON.stringify({ visitorId: "not-a-uuid" }),
        jsonHeaders
      )
    ).status,
    400
  );
  assert.equal((await callApi(database, "DELETE")).status, 405);
  assert.equal((await callApi(null, "GET")).status, 503);
});

test("POST enforces same-origin JSON requests and the body-size limit", async () => {
  const database = new MockD1();

  assert.equal(
    (
      await callApi(database, "POST", JSON.stringify({ visitorId: FIRST_VISITOR }), {
        "Content-Type": "text/plain",
      })
    ).status,
    415
  );
  assert.equal(
    (
      await callApi(database, "POST", "x".repeat(1_025), {
        "Content-Type": "application/json",
      })
    ).status,
    413
  );
  assert.equal(
    (
      await callApi(
        database,
        "POST",
        JSON.stringify({ visitorId: FIRST_VISITOR }),
        {
          "Content-Type": "application/json",
          Origin: "https://example.com",
        }
      )
    ).status,
    403
  );
  assert.equal(database.counts.size, 0);
  assert.equal(database.dedupe.size, 0);
});

test("well-formed slugs that are not published do not create rows", async () => {
  const database = new MockD1();
  const response = await callApi(
    database,
    "POST",
    JSON.stringify({ visitorId: FIRST_VISITOR }),
    { "Content-Type": "application/json" },
    "unpublished-article"
  );
  assert.equal(response.status, 404);
  assert.equal(database.counts.size, 0);
  assert.equal(database.dedupe.size, 0);
});

test("the front end hides sub-threshold counts and formats public counts", () => {
  const element = { hidden: false, textContent: "placeholder" };

  assert.equal(
    updateVisibleCount(element, { public: false, count: 99 }, "en-US"),
    false
  );
  assert.equal(element.hidden, true);
  assert.equal(element.textContent, "");

  assert.equal(
    updateVisibleCount(element, { public: true, count: 100 }, "en-US"),
    true
  );
  assert.equal(element.hidden, false);
  assert.equal(element.textContent, "100 views");
  assert.equal(formatViewCount(1_245, "en-US"), "1,245 views");
  assert.equal(formatViewCount(1, "en-US"), "1 view");
});

test("local storage failure disables POST state without crashing", () => {
  const storage = {
    getItem() {
      throw new Error("Storage blocked");
    },
  };
  assert.equal(
    getOrCreateVisitorState(ARTICLE_SLUG, storage, globalThis.crypto),
    null
  );
});

test("the five-second qualifier waits for visible time and pauses while hidden", async () => {
  let currentTime = 0;
  let timer = null;
  const listeners = new Map();
  const documentRef = {
    visibilityState: "hidden",
    prerendering: false,
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };

  const qualified = waitForVisibleDuration(5_000, {
    documentRef,
    now: () => currentTime,
    schedule: (callback, delay) => {
      timer = { callback, delay };
      return timer;
    },
    cancel: () => {
      timer = null;
    },
  });

  assert.equal(timer, null);
  documentRef.visibilityState = "visible";
  listeners.get("visibilitychange")();
  assert.equal(timer.delay, 5_000);

  currentTime = 2_000;
  documentRef.visibilityState = "hidden";
  listeners.get("visibilitychange")();
  assert.equal(timer, null);

  documentRef.visibilityState = "visible";
  listeners.get("visibilitychange")();
  assert.equal(timer.delay, 3_000);
  currentTime = 5_000;
  timer.callback();
  await qualified;
});

test("the deployment worker routes only the view API through the function", async () => {
  const database = new MockD1();
  const assetRequests = [];
  const environment = {
    ARTICLE_VIEWS_DB: database,
    ASSETS: {
      async fetch(assetRequest) {
        const pathname = new URL(assetRequest.url).pathname;
        assetRequests.push(pathname);
        if (pathname === "/404.html") {
          return new Response("not found page", { status: 200 });
        }
        if (pathname === "/missing") {
          return new Response("missing", { status: 404 });
        }
        return new Response("static asset", { status: 200 });
      },
    },
  };

  const apiResponse = await worker.fetch(
    new Request(`https://cantdecide.org/api/views/${ARTICLE_SLUG}`),
    environment
  );
  assert.equal(apiResponse.status, 200);
  assert.deepEqual(assetRequests, []);

  const assetResponse = await worker.fetch(
    new Request("https://cantdecide.org/assets/css/styles.css"),
    environment
  );
  assert.equal(assetResponse.status, 200);
  assert.deepEqual(assetRequests, ["/assets/css/styles.css"]);

  const missingResponse = await worker.fetch(
    new Request("https://cantdecide.org/missing"),
    environment
  );
  assert.equal(missingResponse.status, 200);
  assert.deepEqual(assetRequests, [
    "/assets/css/styles.css",
    "/missing",
    "/404.html",
  ]);
});
