# economic-data-collector

실시간 경제 데이터(환율·주요지수·뉴스·거시지표)를 PostgreSQL/TimescaleDB에 적재하고 Grafana로 시각화하며, 급변 시 Slack으로 알림.

## 무엇을 수집하나

| 카테고리 | 소스 | 주기(기본) | 테이블 |
|---------|------|----------|--------|
| 환율·원자재 (USD/KRW, EUR/USD, JPY, CNY, 금, WTI) | Yahoo Finance | 1분 | `fx_rates` |
| 주요 지수 (KOSPI, KOSDAQ, S&P500, NASDAQ, DJIA, Nikkei, HSI, Euro Stoxx) | Yahoo Finance | 5분 | `market_indices` |
| 경제 뉴스 헤드라인 (한국·미국·글로벌) | **Firecrawl `/search`** | 1시간 | `economic_news` |
| 한국 거시지표 (기준금리·CPI·M2·실질GDP) | 한국은행 ECOS API | 일 1회 | `macro_indicators` |

각 테이블은 TimescaleDB **hypertable** — 시계열 쿼리·압축·연속 집계에 최적화됨.

## 빠른 시작

```bash
# 1) DB + Grafana 기동 (마이그레이션 자동 적용)
docker compose up -d

# 2) 환경변수
cp .env.example .env
#  .env 열고 FIRECRAWL_API_KEY, (선택) ECOS_API_KEY, SLACK_WEBHOOK_URL 입력

# 3) 의존성
pnpm install

# 4) 한 번만 수집 (스모크 테스트)
pnpm collect:once

# 5) 스케줄러로 상시 실행
pnpm dev
```

대시보드: <http://localhost:3001> (anonymous Viewer 자동 허용, admin 로그인은 admin/admin)

## 알림 (Slack)

`SLACK_WEBHOOK_URL`을 설정하면 FX/지수 수집 시 다음 조건에서 메시지를 보냅니다:

| 환경변수 | 기본 | 의미 |
|---------|-----|------|
| `ALERT_FX_PCT` | 0.5 | FX 절대 변동률 임계치 (%) |
| `ALERT_INDEX_PCT` | 1.5 | 지수 절대 변동률 임계치 (%) |
| `ALERT_COOLDOWN_MIN` | 30 | 동일 심볼 알림 쿨다운 (분) |

알림 이력은 `alerts_sent` 테이블에 적재되어 Grafana 패널에서 확인 가능합니다.

## 환경변수 전체

| 변수 | 기본값 | 설명 |
|-----|-------|------|
| `DATABASE_URL` | `postgres://econ:econ@localhost:5433/econdata` | Postgres 접속 문자열 |
| `FIRECRAWL_API_KEY` | (뉴스 수집 시 필수) | Firecrawl API 키 |
| `FIRECRAWL_API_URL` | `https://api.firecrawl.dev` | 셀프호스트 시 변경 |
| `ECOS_API_KEY` | (거시지표 수집 시 필수) | <https://ecos.bok.or.kr/api/> 발급 |
| `SLACK_WEBHOOK_URL` | (선택) | 미설정 시 알림 비활성 |
| `FX_CRON` | `*/1 * * * *` | 환율 수집 cron |
| `INDICES_CRON` | `*/5 * * * *` | 지수 수집 cron |
| `NEWS_CRON` | `0 * * * *` | 뉴스 수집 cron |
| `MACRO_CRON` | `0 9 * * *` | ECOS 수집 cron |
| `TZ` | `Asia/Seoul` | cron 타임존 |

## Grafana 대시보드 (`Economic Data Overview`)

자동 프로비저닝되는 패널:
- FX Rates (시계열)
- Market Indices (시계열)
- Latest FX (현재값 카드)
- Latest Indices % Change (배경 색상 카드)
- Recent Economic News (50개 헤드라인 + URL)
- Recent Alerts (Slack 발송 이력)
- Korea Macro / ECOS (계단형 시계열)

대시보드 JSON은 `grafana/dashboards/econ.json`. UI에서 수정한 내용은 컨테이너 재시작 시 30초 폴링으로 재반영됩니다(`allowUiUpdates`).

## 확장 포인트

- `src/config.ts` `ECOS_SERIES`에 항목 추가 → 거시지표 확장
- DART, FOMC 캘린더 → Firecrawl `/extract`로 구조화
- 알림 채널 추가: Discord, Telegram → `src/lib/alerts.ts` `postToSlack` 옆에 함수 추가
- 연속 집계 (Continuous Aggregate): `CREATE MATERIALIZED VIEW ... WITH (timescaledb.continuous)` 로 1분 시봉 → 1시간 시봉 자동 롤업
