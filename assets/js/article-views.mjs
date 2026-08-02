const PUBLIC_THRESHOLD = 100;
const QUALIFICATION_MS = 5_000;
const LOCAL_DEDUPE_MS = 24 * 60 * 60 * 1_000;
const STORAGE_VALUE_LIMIT = 512;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function formatViewCount(count, locales) {
  const safeCount = Number(count);
  const formatted = new Intl.NumberFormat(locales).format(safeCount);
  return `${formatted} ${safeCount === 1 ? "view" : "views"}`;
}

export function updateVisibleCount(element, payload, locales) {
  const count = Number(payload?.count);
  const shouldDisplay =
    payload?.public === true &&
    Number.isSafeInteger(count) &&
    count >= PUBLIC_THRESHOLD;

  if (!shouldDisplay) {
    element.hidden = true;
    element.textContent = "";
    return false;
  }

  element.textContent = formatViewCount(count, locales);
  element.hidden = false;
  return true;
}

export function isValidArticleSlug(slug) {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= 96 &&
    SLUG_PATTERN.test(slug)
  );
}

function isValidVisitorId(visitorId) {
  return typeof visitorId === "string" && UUID_V4_PATTERN.test(visitorId);
}

function generateVisitorId(cryptoRef) {
  if (typeof cryptoRef?.randomUUID === "function") {
    return cryptoRef.randomUUID();
  }

  if (typeof cryptoRef?.getRandomValues !== "function") {
    return null;
  }

  const bytes = new Uint8Array(16);
  cryptoRef.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function storageKey(slug) {
  return `cantdecide:article-view:${slug}`;
}

export function getOrCreateVisitorState(
  slug,
  storage,
  cryptoRef,
  now = Date.now()
) {
  const key = storageKey(slug);

  try {
    const storedValue = storage.getItem(key);
    if (storedValue && storedValue.length <= STORAGE_VALUE_LIMIT) {
      const parsed = JSON.parse(storedValue);
      if (
        isValidVisitorId(parsed?.visitorId) &&
        Number.isFinite(parsed?.lastCountedAt)
      ) {
        return {
          key,
          visitorId: parsed.visitorId,
          lastCountedAt: Number(parsed.lastCountedAt),
        };
      }
    }

    const visitorId = generateVisitorId(cryptoRef);
    if (!visitorId || !isValidVisitorId(visitorId)) {
      return null;
    }

    const state = { key, visitorId, lastCountedAt: 0 };
    storage.setItem(
      key,
      JSON.stringify({
        visitorId: state.visitorId,
        lastCountedAt: state.lastCountedAt,
      })
    );
    return state;
  } catch {
    return null;
  }
}

function saveSuccessfulCountTimestamp(storage, state, timestamp) {
  try {
    storage.setItem(
      state.key,
      JSON.stringify({
        visitorId: state.visitorId,
        lastCountedAt: timestamp,
      })
    );
  } catch {
    // Storage can be unavailable without affecting the article.
  }
}

export function waitForVisibleDuration(
  durationMs = QUALIFICATION_MS,
  {
    documentRef = document,
    now = () => performance.now(),
    schedule = (callback, delay) => window.setTimeout(callback, delay),
    cancel = (timer) => window.clearTimeout(timer),
  } = {}
) {
  return new Promise((resolve) => {
    let remaining = durationMs;
    let visibleSince = null;
    let timer = null;
    let finished = false;

    function isQualifying() {
      return (
        documentRef.visibilityState === "visible" &&
        documentRef.prerendering !== true
      );
    }

    function stopTimer() {
      if (visibleSince !== null) {
        remaining = Math.max(0, remaining - (now() - visibleSince));
        visibleSince = null;
      }
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
    }

    function finish() {
      if (finished) {
        return;
      }
      finished = true;
      stopTimer();
      documentRef.removeEventListener("visibilitychange", handleVisibility);
      documentRef.removeEventListener("prerenderingchange", handleVisibility);
      resolve();
    }

    function startTimer() {
      if (finished || !isQualifying()) {
        return;
      }
      if (remaining <= 0) {
        finish();
        return;
      }

      visibleSince = now();
      timer = schedule(finish, remaining);
    }

    function handleVisibility() {
      stopTimer();
      startTimer();
    }

    documentRef.addEventListener("visibilitychange", handleVisibility);
    documentRef.addEventListener("prerenderingchange", handleVisibility);
    startTimer();
  });
}

async function readJsonResponse(response) {
  if (!response.ok) {
    return null;
  }

  try {
    const payload = await response.json();
    return payload?.ok === true ? payload : null;
  } catch {
    return null;
  }
}

async function initializeArticleViews() {
  const slug = document.body?.dataset.articleSlug;
  const counter = document.querySelector("[data-article-view-count]");

  if (!isValidArticleSlug(slug) || !counter) {
    return;
  }

  const endpoint = `/api/views/${encodeURIComponent(slug)}`;

  try {
    const current = await readJsonResponse(
      await fetch(endpoint, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
    );
    if (current) {
      updateVisibleCount(counter, current);
    }
  } catch {
    // The counter is an enhancement; API failure must not affect the article.
  }

  const state = getOrCreateVisitorState(
    slug,
    window.localStorage,
    window.crypto
  );
  if (!state) {
    return;
  }

  const elapsed = Date.now() - state.lastCountedAt;
  if (elapsed >= 0 && elapsed < LOCAL_DEDUPE_MS) {
    return;
  }

  await waitForVisibleDuration();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ visitorId: state.visitorId }),
    });
    const result = await readJsonResponse(response);
    if (!result) {
      return;
    }

    saveSuccessfulCountTimestamp(window.localStorage, state, Date.now());
    updateVisibleCount(counter, result);
  } catch {
    // Deliberately no retry loop and no user-facing error.
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeArticleViews, {
      once: true,
    });
  } else {
    initializeArticleViews();
  }
}
