import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const cleanPages = new Map([
  ["contact.html", "https://cantdecide.org/contact"],
  ["mission.html", "https://cantdecide.org/mission"],
  ["privacy.html", "https://cantdecide.org/privacy"],
  ["terms.html", "https://cantdecide.org/terms"],
  ["responsible-use.html", "https://cantdecide.org/responsible-use"],
]);

const articleUrls = [
  "https://cantdecide.org/decision-science/",
  "https://cantdecide.org/decision-science/why-everything-seems-to-go-wrong-in-a-bad-mood/",
  "https://cantdecide.org/decision-science/the-invisible-push/",
  "https://cantdecide.org/decision-science/how-the-brain-makes-decisions/",
  "https://cantdecide.org/decision-science/how-to-stop-overthinking-a-decision/",
  "https://cantdecide.org/decision-science/sunk-cost-fallacy/",
  "https://cantdecide.org/decision-science/paradox-of-choice/",
  "https://cantdecide.org/decision-science/decision-fatigue/",
  "https://cantdecide.org/decision-science/planning-fallacy/",
];

function read(relativePath) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

function occurrences(text, value) {
  return text.split(value).length - 1;
}

function collectHtmlFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "dist") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectHtmlFiles(fullPath));
    if (entry.isFile() && entry.name.endsWith(".html")) files.push(fullPath);
  }
  return files;
}

test("static pages publish clean self-referencing canonical and Open Graph URLs", () => {
  for (const [file, cleanUrl] of cleanPages) {
    const html = read(file);
    assert.equal(
      occurrences(html, `<link rel="canonical" href="${cleanUrl}">`),
      1,
      `${file} canonical`
    );
    assert.equal(
      occurrences(html, `<meta property="og:url" content="${cleanUrl}">`),
      1,
      `${file} Open Graph URL`
    );
    assert.doesNotMatch(html, new RegExp(`${cleanUrl.replaceAll("/", "\\/")}\\.html`));
  }
});

test("redirect rules send every legacy and trailing-slash URL directly to clean URLs", () => {
  const redirects = read("_redirects");
  for (const [file, cleanUrl] of cleanPages) {
    const slug = file.slice(0, -5);
    const destination = new URL(cleanUrl).pathname;
    assert.match(redirects, new RegExp(`^/${slug}\\.html\\s+${destination}\\s+301$`, "m"));
    assert.match(redirects, new RegExp(`^/${slug}/\\s+${destination}\\s+301$`, "m"));
  }
  assert.doesNotMatch(redirects, /\/decision-science\/\*/);
});

test("sitemap contains only clean static URLs and preserves every article URL", () => {
  const sitemap = read("sitemap.xml");
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(sitemap, /<\/urlset>\s*$/);

  for (const [file, cleanUrl] of cleanPages) {
    assert.equal(occurrences(sitemap, `<loc>${cleanUrl}</loc>`), 1);
    assert.equal(occurrences(sitemap, `<loc>https://cantdecide.org/${file}</loc>`), 0);
  }
  for (const articleUrl of articleUrls) {
    assert.equal(occurrences(sitemap, `<loc>${articleUrl}</loc>`), 1);
  }
});

test("public HTML links never point through affected .html or index.html redirects", () => {
  const legacyLink = /href="(?:\.\.\/\.\.\/|\/)?(?:contact|mission|privacy|terms|responsible-use)\.html(?:[?#][^"]*)?"/;
  const indexLink = /href="(?:\.\.\/\.\.\/)?index\.html(?:[?#][^"]*)?"/;
  for (const file of collectHtmlFiles(repositoryRoot)) {
    const html = readFileSync(file, "utf8");
    assert.doesNotMatch(html, legacyLink, path.relative(repositoryRoot, file));
    assert.doesNotMatch(html, indexLink, path.relative(repositoryRoot, file));
  }
});

test("robots.txt allows crawlers to inspect clean pages and legacy redirects", () => {
  const robots = read("robots.txt");
  assert.match(robots, /User-agent:\s*\*/);
  for (const slug of ["contact", "mission", "privacy", "terms", "responsible-use"]) {
    assert.doesNotMatch(robots, new RegExp(`Disallow:\\s*/${slug}(?:\\.html)?`));
  }
});
