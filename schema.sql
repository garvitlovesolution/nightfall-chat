-- Generic document store used by the optional D1 adapter (/api/sync).
CREATE TABLE IF NOT EXISTS docs (
  owner TEXT NOT NULL,
  store TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner, store, id)
);
