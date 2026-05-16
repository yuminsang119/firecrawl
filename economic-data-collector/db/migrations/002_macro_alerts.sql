CREATE TABLE IF NOT EXISTS macro_indicators (
    ts          TIMESTAMPTZ      NOT NULL,
    series_id   TEXT             NOT NULL,
    name        TEXT             NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    period      TEXT             NOT NULL,
    cycle       TEXT,
    unit        TEXT,
    region      TEXT             NOT NULL,
    source      TEXT             NOT NULL,
    PRIMARY KEY (series_id, ts)
);
SELECT create_hypertable('macro_indicators', 'ts', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS macro_indicators_region_ts ON macro_indicators (region, ts DESC);
CREATE INDEX IF NOT EXISTS macro_indicators_series_ts ON macro_indicators (series_id, ts DESC);

CREATE TABLE IF NOT EXISTS alerts_sent (
    ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
    kind       TEXT NOT NULL,
    symbol     TEXT NOT NULL,
    change_pct DOUBLE PRECISION,
    price      DOUBLE PRECISION,
    message    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS alerts_sent_symbol_ts ON alerts_sent (symbol, ts DESC);
