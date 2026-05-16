# economic-data-collector

실시간 경제 데이터(환율·주요지수·뉴스 헤드라인)를 PostgreSQL/TimescaleDB에 적재하는 MVP 수집기.

## 무엇을 수집하나

| 카테고리 | 소스 | 주기(기본) | 테이블 |
|---------|------|----------|--------|
| 환율·원자재 (USD/KRW, EUR/USD, JPY, CNY, 금, WTI) | Yahoo Finance | 1분 | `fx_rates` |
| 주요 지수 (KOSPI, KOSDAQ, S&P500, NASDAQ, DJIA, Nikkei, HSI, Euro Stoxx) | Yahoo Finance | 5분 | `market_indices` |
| 경제 뉴스 헤드라인 (한국·미국·글로벌) | **Firecrawl `/search`** | 1시간 | `economic_news` |

각 테이블은 TimescaleDB **hypertable** — 시계열 쿼리·압축·연속 집계에 최적화됨.

## 빠른 시작

```bash
# 1) DB 기동 (Postgres 16 + TimescaleDB, 마이그레이션 자동 적용)
docker compose up -d

# 2) 환경변수
cp .env.example .env
# .env 파일을 열어 FIRECRAWL_API_KEY 입력

# 3) 의존성
pnpm install   # 또는 npm install

# 4) 한 번만 수집 (스모크 테스트)
pnpm collect:once

# 5) 스케줄러로 상시 실행
pnpm dev
```

## 환경변수

| 변수 | 기본값 | 설명 |
|-----|-------|------|
| `DATABASE_URL` | `postgres://econ:econ@localhost:5433/econdata` | Postgres 접속 문자열 |
| `FIRECRAWL_API_KEY` | (필수, 뉴스 수집 시) | Firecrawl API 키 |
| `FIRECRAWL_API_URL` | `https://api.firecrawl.dev` | 셀프호스트 시 변경 |
| `FX_CRON` | `*/1 * * * *` | 환율 수집 cron |
| `INDICES_CRON` | `*/5 * * * *` | 지수 수집 cron |
| `NEWS_CRON` | `0 * * * *` | 뉴스 수집 cron |
| `TZ` | `Asia/Seoul` | cron 타임존 |

## 대시보드 연결

`DATABASE_URL`을 Grafana 또는 Metabase의 PostgreSQL 데이터소스로 등록하면 됩니다.
TimescaleDB 함수(`time_bucket`, `last`)를 활용한 예시:

```sql
SELECT time_bucket('5 minutes', ts) AS bucket,
       symbol,
       last(price, ts) AS price
FROM   fx_rates
WHERE  ts > now() - interval '1 day'
GROUP  BY bucket, symbol
ORDER  BY bucket;
```

## 확장 포인트

- 한국은행 ECOS API → 기준금리·M2 등 거시지표 (`collectors/macro.ts` 신설)
- DART → 공시 메타데이터
- Firecrawl `/extract` 스키마로 특정 사이트 정확 파싱
- 알림: Slack 웹훅 (`change_pct` 임계치 트리거)
