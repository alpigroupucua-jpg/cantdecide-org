#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SITE_ORIGIN = "https://cantdecide.org";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const INDEXNOW_KEY = "e2174ba6f8575b7658f2f2027a82768d";
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");

const requestedUrls = process.argv.slice(2);

if (requestedUrls.length === 0) {
  console.error("Usage: node scripts/submit-indexnow.mjs <canonical-url> [canonical-url ...]");
  process.exit(1);
}

if (requestedUrls.length > 100) {
  console.error("Refusing to submit more than 100 URLs in one manual run.");
  process.exit(1);
}

const sitemap = await readFile(path.join(projectDirectory, "sitemap.xml"), "utf8");
const sitemapUrls = new Set(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
);
const urlList = [...new Set(requestedUrls)];

for (const candidate of urlList) {
  let parsedUrl;
  try {
    parsedUrl = new URL(candidate);
  } catch {
    console.error(`Invalid URL: ${candidate}`);
    process.exit(1);
  }

  if (parsedUrl.origin !== SITE_ORIGIN || parsedUrl.search || parsedUrl.hash) {
    console.error(`Only clean canonical ${SITE_ORIGIN} URLs can be submitted: ${candidate}`);
    process.exit(1);
  }

  if (!sitemapUrls.has(candidate)) {
    console.error(`URL is not present in sitemap.xml: ${candidate}`);
    process.exit(1);
  }
}

const response = await fetch(INDEXNOW_ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: "cantdecide.org",
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
    urlList,
  }),
});

if (!response.ok && response.status !== 202) {
  const responseText = await response.text();
  console.error(`IndexNow rejected the submission (${response.status}): ${responseText}`);
  process.exit(1);
}

console.log(`IndexNow accepted ${urlList.length} URL${urlList.length === 1 ? "" : "s"} (${response.status}).`);
