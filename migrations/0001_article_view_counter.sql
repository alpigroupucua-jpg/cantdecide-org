CREATE TABLE IF NOT EXISTS article_view_counts (
    article_slug TEXT PRIMARY KEY,
    view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS article_view_dedupe (
    article_slug TEXT NOT NULL,
    visitor_hash TEXT NOT NULL,
    last_counted_at INTEGER NOT NULL,
    PRIMARY KEY (article_slug, visitor_hash)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_article_view_dedupe_last_counted
ON article_view_dedupe(last_counted_at);
