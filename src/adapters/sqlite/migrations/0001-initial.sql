-- whenkit schema v1 (AD-4, AD-5). Append-only: never edit this file after it
-- reaches main; add a new numbered migration instead. Timestamps are written
-- by core from the Clock port, so no column has a temporal DEFAULT.

-- Single row holding the owner of every other row; filled by the migration
-- hook in sqlite-catalog-store.ts together with the start categories.
CREATE TABLE meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  owner_id TEXT NOT NULL
) STRICT;

-- `seq` is the FTS rowid: an INTEGER PRIMARY KEY never changes on VACUUM,
-- so the external-content index stays in sync.
CREATE TABLE entries (
  seq INTEGER PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('tool', 'material', 'concept')),
  name TEXT NOT NULL,
  url TEXT,
  resource_type TEXT CHECK (resource_type IN ('repo', 'site', 'app')),
  what_it_does TEXT NOT NULL,
  situations TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(situations) AND json_type(situations) = 'array'),
  keywords TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(keywords) AND json_type(keywords) = 'array'),
  sources TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(sources) AND json_type(sources) = 'array'),
  content TEXT,
  my_notes TEXT NOT NULL DEFAULT '',
  github_stars INTEGER,
  github_pushed_at TEXT,
  github_archived INTEGER CHECK (github_archived IN (0, 1)),
  verification_notes TEXT NOT NULL DEFAULT '[]'
    CHECK (
      json_valid(verification_notes)
      AND json_type(verification_notes) = 'array'
    ),
  forced INTEGER NOT NULL DEFAULT 0 CHECK (forced IN (0, 1)),
  dedup_key TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  added_at TEXT NOT NULL,
  verified_at TEXT,
  CHECK (kind = 'concept' OR url IS NOT NULL),
  UNIQUE (owner_id, dedup_key)
) STRICT;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  zone TEXT NOT NULL CHECK (zone IN ('toolbox', 'learn')),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  UNIQUE (owner_id, zone, name_key)
) STRICT;

CREATE TABLE entry_categories (
  entry_id TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories (id),
  PRIMARY KEY (entry_id, category_id)
) STRICT, WITHOUT ROWID;

CREATE INDEX entry_categories_category ON entry_categories (category_id);

-- `related` is stored once, canonically (from_id < to_id); `parent` goes
-- from the umbrella concept to its child.
CREATE TABLE links (
  type TEXT NOT NULL CHECK (type IN ('related', 'parent')),
  from_id TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  UNIQUE (type, from_id, to_id),
  CHECK (from_id <> to_id),
  CHECK (type <> 'related' OR from_id < to_id)
) STRICT;

CREATE INDEX links_from ON links (from_id);
CREATE INDEX links_to ON links (to_id);

-- Rejected batch elements, kept exactly as they passed the batch schema.
CREATE TABLE rejections (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  dedup_key TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('add', 'update')),
  element TEXT NOT NULL CHECK (json_valid(element)),
  reasons TEXT NOT NULL
    CHECK (json_valid(reasons) AND json_type(reasons) = 'array'),
  batch_schema_version INTEGER NOT NULL,
  rejected_at TEXT NOT NULL
) STRICT;

CREATE INDEX rejections_dedup ON rejections (owner_id, dedup_key);

-- The text the full-text index sees: each JSON list joined with spaces, in
-- order. FTS5 reads it back from this view (rebuild, integrity-check,
-- highlight, snippet), and the triggers below copy their rows from it, so the
-- index and its source cannot disagree. The lists are joined with a
-- recursive json_extract walk, not json_each: SQLite refuses json_each
-- inside a view when FTS5 reads the view ("no such table: main.json_each").
CREATE VIEW entries_fts_source AS
SELECT
  seq,
  name,
  what_it_does,
  (
    WITH RECURSIVE item (n, joined) AS (
      SELECT 0, NULL
      UNION ALL
      SELECT
        n + 1,
        coalesce(joined || ' ', '')
          || coalesce(json_extract(entries.situations, '$[' || n || ']'), '')
      FROM item
      WHERE n < json_array_length(entries.situations)
    )
    SELECT joined FROM item ORDER BY n DESC LIMIT 1
  ) AS situations,
  (
    WITH RECURSIVE item (n, joined) AS (
      SELECT 0, NULL
      UNION ALL
      SELECT
        n + 1,
        coalesce(joined || ' ', '')
          || coalesce(json_extract(entries.keywords, '$[' || n || ']'), '')
      FROM item
      WHERE n < json_array_length(entries.keywords)
    )
    SELECT joined FROM item ORDER BY n DESC LIMIT 1
  ) AS keywords,
  content
FROM entries;

-- Full-text index over entries_fts_source, kept in sync only by the
-- triggers below.
CREATE VIRTUAL TABLE entries_fts USING fts5 (
  name,
  what_it_does,
  situations,
  keywords,
  content,
  content = 'entries_fts_source',
  content_rowid = 'seq',
  tokenize = 'unicode61 remove_diacritics 2'
);

-- Removal reads the old row from the view, so it runs BEFORE the row
-- changes; insertion reads the new row, so it runs AFTER.
CREATE TRIGGER entries_fts_insert AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts (rowid, name, what_it_does, situations, keywords, content)
  SELECT seq, name, what_it_does, situations, keywords, content
  FROM entries_fts_source WHERE seq = new.seq;
END;

CREATE TRIGGER entries_fts_delete BEFORE DELETE ON entries BEGIN
  INSERT INTO entries_fts (entries_fts, rowid, name, what_it_does, situations, keywords, content)
  SELECT 'delete', seq, name, what_it_does, situations, keywords, content
  FROM entries_fts_source WHERE seq = old.seq;
END;

CREATE TRIGGER entries_fts_update_old BEFORE UPDATE ON entries BEGIN
  INSERT INTO entries_fts (entries_fts, rowid, name, what_it_does, situations, keywords, content)
  SELECT 'delete', seq, name, what_it_does, situations, keywords, content
  FROM entries_fts_source WHERE seq = old.seq;
END;

CREATE TRIGGER entries_fts_update_new AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts (rowid, name, what_it_does, situations, keywords, content)
  SELECT seq, name, what_it_does, situations, keywords, content
  FROM entries_fts_source WHERE seq = new.seq;
END;
