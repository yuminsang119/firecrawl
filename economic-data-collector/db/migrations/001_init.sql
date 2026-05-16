CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS fx_rates (
    ts          TIMESTAMPTZ      NOT NULL,
    symbol      TEXT             NOT NULL,
    price       DOUBLE PRECISION NOT NULL,
    change_pct  DOUBLE PRECISION,
    source      TEXT             NOT NULL,
    PRIMARY KEY (symbol, ts)
);
SELECT create_hypertable('fx_rates', 'ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS fx_rates_symbol_ts ON fx_rates (symbol, ts DESC);

CREATE TABLE IF NOT EXISTS market_indices (
    ts          TIMESTAMPTZ      NOT NULL,
    symbol      TEXT             NOT NULL,
    name        TEXT             NOT NULL,
    price       DOUBLE PRECISION NOT NULL,
    change_pct  DOUBLE PRECISION,
    volume      BIGINT,
    source      TEXT             NOT NULL,
    PRIMARY KEY (symbol, ts)
);
SELECT create_hypertable('market_indices', 'ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS market_indices_symbol_ts ON market_indices (symbol, ts DESC);

CREATE TABLE IF NOT EXISTS economic_news (
    ts          TIMESTAMPTZ NOT NULL,
    url         TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    summary     TEXT,
    source      TEXT,
    region      TEXT,
    query       TEXT,
    PRIMARY KEY (url, ts)
);
SELECT create_hypertable('economic_news', 'ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS economic_news_ts ON economic_news (ts DESC);
CREATE INDEX IF NOT EXISTS economic_news_region_ts ON economic_news (region, ts DESC);
