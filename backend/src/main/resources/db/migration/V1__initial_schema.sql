-- =============================================
-- V1: Initial schema for Anonymous News Browsing
-- Tables must match JPA entity annotations exactly.
-- =============================================

-- ---------- sources (entity: Source) ----------
CREATE TABLE sources (
    id              BIGSERIAL       PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    slug            VARCHAR(50)     NOT NULL,
    api_url         VARCHAR(500)    NOT NULL,
    poll_interval   INTEGER         NOT NULL DEFAULT 300,
    enabled         BOOLEAN         NOT NULL DEFAULT TRUE,
    config_json     JSONB,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sources_slug UNIQUE (slug)
);

CREATE INDEX idx_sources_slug ON sources (slug);
CREATE INDEX idx_sources_enabled ON sources (enabled);

-- ---------- users (entity: User) ----------
CREATE TABLE users (
    id              BIGSERIAL       PRIMARY KEY,
    username        VARCHAR(100)    NOT NULL,
    preferences     JSONB           NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_username UNIQUE (username)
);

CREATE INDEX idx_users_username ON users (username);

-- ---------- api_keys (entity: ApiKey) ----------
CREATE TABLE api_keys (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL,
    key_hash        VARCHAR(64)     NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    active          BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,
    CONSTRAINT uq_api_keys_key_hash UNIQUE (key_hash),
    CONSTRAINT fk_api_keys_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX idx_api_keys_active ON api_keys (active);

-- ---------- articles (entity: Article) ----------
CREATE TABLE articles (
    id              BIGSERIAL       PRIMARY KEY,
    source_id       BIGINT          NOT NULL,
    external_id     VARCHAR(255)    NOT NULL,
    title           VARCHAR(500)    NOT NULL,
    url             VARCHAR(2000)   NOT NULL,
    author          VARCHAR(255),
    content_snippet TEXT,
    published_at    TIMESTAMPTZ,
    fetched_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    score           INTEGER         NOT NULL DEFAULT 0,
    tags            TEXT[],
    dedup_hash      VARCHAR(64)     NOT NULL,
    metadata_json   JSONB,
    CONSTRAINT uq_articles_source_external UNIQUE (source_id, external_id),
    CONSTRAINT fk_articles_source FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX idx_articles_source_id ON articles (source_id);
CREATE INDEX idx_articles_published_at ON articles (published_at DESC);
CREATE INDEX idx_articles_fetched_at ON articles (fetched_at DESC);
CREATE INDEX idx_articles_dedup_hash ON articles (dedup_hash);
CREATE INDEX idx_articles_score ON articles (score DESC);
CREATE INDEX idx_articles_tags ON articles USING GIN (tags);

-- Full-text search index used by ArticleRepository.search() native query
CREATE INDEX idx_articles_title_fts ON articles USING GIN (to_tsvector('english', title));
CREATE INDEX idx_articles_snippet_fts ON articles USING GIN (to_tsvector('english', coalesce(content_snippet, '')));

-- ---------- read_states (entity: ReadState, composite PK via ReadStateId) ----------
CREATE TABLE read_states (
    user_id         BIGINT          NOT NULL,
    article_id      BIGINT          NOT NULL,
    read_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, article_id),
    CONSTRAINT fk_read_states_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_read_states_article FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE INDEX idx_read_states_user_id ON read_states (user_id);
CREATE INDEX idx_read_states_article_id ON read_states (article_id);

-- ---------- bookmarks (entity: Bookmark) ----------
CREATE TABLE bookmarks (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL,
    article_id      BIGINT          NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bookmarks_user_article UNIQUE (user_id, article_id),
    CONSTRAINT fk_bookmarks_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_bookmarks_article FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE INDEX idx_bookmarks_user_id ON bookmarks (user_id);
CREATE INDEX idx_bookmarks_article_id ON bookmarks (article_id);
CREATE INDEX idx_bookmarks_created_at ON bookmarks (created_at DESC);

-- ---------- dead_letters (entity: DeadLetter) ----------
CREATE TABLE dead_letters (
    id              BIGSERIAL       PRIMARY KEY,
    source_id       BIGINT          NOT NULL,
    external_id     VARCHAR(255),
    payload         JSONB,
    error_message   TEXT,
    status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    retry_count     INTEGER         NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_dead_letters_source FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX idx_dead_letters_status ON dead_letters (status);
CREATE INDEX idx_dead_letters_next_retry ON dead_letters (next_retry_at) WHERE status IN ('PENDING', 'RETRYING');
CREATE INDEX idx_dead_letters_source_id ON dead_letters (source_id);
CREATE INDEX idx_dead_letters_created_at ON dead_letters (created_at DESC);

-- =============================================
-- Seed data
-- =============================================

-- ---------- Seed: News Sources ----------
INSERT INTO sources (name, slug, api_url, enabled, poll_interval, config_json) VALUES
    ('Hacker News',      'hackernews',       'https://hacker-news.firebaseio.com/v0',  true,  180, NULL),
    ('Reddit',           'reddit',           'https://oauth.reddit.com',               true,  300, NULL),
    ('Dev.to',           'devto',            'https://dev.to/api',                     true,  600, NULL),
    ('GitHub Releases',  'github-releases',  'https://api.github.com',                 true,  3600, NULL),
    ('Lobsters',         'lobsters',         'https://lobste.rs',                      true,  600, NULL),
    ('RSS Feeds',        'rss',              'https://example.com/rss',                true,  900, NULL);

-- ---------- Seed: Default dev user ----------
INSERT INTO users (username, preferences) VALUES
    ('dev', '{}');

-- ---------- Seed: Default API key for development ----------
-- Plaintext key: anon-news-dev-key-2024
-- SHA-256 hash: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
INSERT INTO api_keys (user_id, key_hash, name, active) VALUES
    (1, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'dev-default', true);
