# `PRD.md` — FOMObot (V1)

## 1) Executive Summary

FOMObot monitors two curated token lists (each tied to a specific Telegram group). Every 60 s it fetches **market-cap data** for those tokens, compares each to its **initial market cap at call-out time**, and posts Telegram alerts whenever a token's market cap reaches configurable multiples (e.g., 2× → 10×).
The service is **backend-only** (NestJS + TypeScript), hosted on **Railway**, and uses **Supabase** for both reading token data and persisting milestone notification history to prevent duplicate alerts.

Provider access is abstracted, so CoinGecko / CoinMarketCap / Birdeye can be swapped transparently.

---

## 2) Objectives & Success Criteria

**Objectives**

* Detect and alert on milestone jumps in market cap for two token groups.
* Maintain ~500 token/min throughput.
* Keep architecture provider-agnostic and read-only toward Supabase.

**Success Criteria**

* 100 % of milestone crossings detected within ≤ 60 s.
* Zero duplicate messages for the same milestone across server restarts.
* Each milestone is notified exactly once per token.
* API or network errors logged but never block other tokens.
* Milestone notification history persisted to prevent spam.

---

## 3) Scope (V1)

**In scope**

* Two Supabase tables (`tokens_fsm`, `tokens_issam`), read-only.
* Dynamic milestone configuration table (`milestones_config`), read-write.
* Milestone notification tracking table (`milestone_notifications`), read-write.
* Periodic polling (default 60 s, configurable).
* Per-group milestone thresholds with custom labels.
* Separate Telegram notifications per group.
* Milestone notification persistence to prevent duplicates.
* Health & stats endpoints.
* Logging + retry logic.
* CI/CD via GitHub Actions → Railway.

**Out of scope**

* Frontend / dashboard.
* Cross-chain support beyond Solana.
* Advanced alert routing (Discord/email).
* Token data modifications (only milestone notifications are written).

---

## 4) Token Groups

| Group | Table          | Telegram Target  |
| ----- | -------------- | ---------------- |
| FSM   | `tokens_fsm`   | FSM group chat   |
| Issam | `tokens_issam` | Issam group chat |

Each table lists the tokens that belong exclusively to that group.

---

## 5) Supabase Schema

### Token Tables (read-only)
```
tokens_fsm / tokens_issam:
id bigint
token_address varchar
symbol varchar
initial_market_cap_usd numeric
first_called_at_utc timestamptz
posted_message_id varchar
peak_market_cap_usd numeric
peak_timestamp timestamptz
max_percentage_profit numeric
multiple numeric
time_to_peak interval
time_to_peak_formatted text
```

### Milestones Configuration Table (read-write)
```
milestones_config:
id bigserial PRIMARY KEY
group_name varchar NOT NULL CHECK (group_name IN ('fsm', 'issam'))
milestone_value numeric NOT NULL
milestone_label varchar NOT NULL
is_active boolean NOT NULL DEFAULT true
created_at_utc timestamptz NOT NULL DEFAULT NOW()
updated_at_utc timestamptz NOT NULL DEFAULT NOW()
created_by varchar
notes text
UNIQUE(group_name, milestone_value)
```

### Milestone Notifications Table (read-write)
```
milestone_notifications:
id bigserial PRIMARY KEY
token_id bigint NOT NULL
token_address varchar NOT NULL
group_name varchar NOT NULL CHECK (group_name IN ('fsm', 'issam'))
milestone_value numeric NOT NULL
milestone_label varchar NOT NULL
notified_at_utc timestamptz NOT NULL DEFAULT NOW()
message_id varchar
UNIQUE(token_id, milestone_value)
```

> FOMObot **never modifies** token data in `tokens_fsm` or `tokens_issam`.
> The bot only **reads** token rows and **writes** milestone notification records.

---

## 6) Core Logic

1. Every `POLL_INTERVAL_SECONDS` (default 60 s):

   * Read all tokens from both tables.
   * **Load active milestones** from `milestones_config` table for each group.
   * Fetch current market caps via the configured provider.
   * For each token, compute `ratio = current_cap / initial_market_cap_usd`.
   * Compare `ratio` against **per-group milestone thresholds**.
2. For each milestone crossed in this cycle:

   * **Check if notification already sent** by querying `milestone_notifications` table.
   * If not previously notified, post a **new Telegram message** with **custom milestone label** and **record the notification**.
3. If market-cap data missing → skip & log.
4. Milestone notification history is persisted to prevent duplicate alerts.

### Dynamic Milestone Configuration

Milestones are configured per group in the `milestones_config` table:
- **Per-group thresholds**: FSM and Issam can have different milestone values
- **Custom labels**: Each milestone has a display label (e.g., "2×", "3×", "🚀 5×")
- **Active/inactive**: Milestones can be enabled/disabled without deletion
- **Audit trail**: Track who created/modified milestones and when

### Milestone Persistence

Each milestone notification is recorded in the `milestone_notifications` table with:
- `token_id` and `milestone_value` combination (unique constraint prevents duplicates)
- `milestone_label` for display in messages
- `group_name` to track which Telegram group was notified
- `notified_at_utc` timestamp
- Optional `message_id` for Telegram message reference

### Recrossing Prevention

Once a milestone is notified for a token, it will **never** be notified again, even if the token falls below and re-crosses the milestone.

### Multi-milestone jumps

If a token jumps multiple milestones in one poll, send all active milestones sequentially, but only for milestones not previously notified.

---

## 7) Market-Cap Provider Abstraction

| Provider          | Free-tier fit | Solana coverage     | Market-cap data    | Speed / batching       | Notes                                    |
| ----------------- | ------------- | ------------------- | ------------------ | ---------------------- | ---------------------------------------- |
| **CoinGecko**     | ★★☆☆☆         | Multi-chain         | Yes (listed coins) | REST, limited          | Free & broad but may miss new SOL tokens |
| **CoinMarketCap** | ★★★☆☆         | Multi-chain         | Yes                | 300 req/min (free key) | Paid tier gives better coverage          |
| **Birdeye**       | ★★★★☆         | **Excellent (SOL)** | Derived (FDV)      | Fast                   | Solana-centric, ideal fallback           |

> Start with **CoinGecko**; switch via ENV when needed.
> Provider chosen at runtime through abstraction layer.

---

## 8) Telegram Messaging

**Template**

```
🚨 ${SYMBOL} hit ${MILESTONE_LABEL} market cap since call-out!
Initial MC: $${INITIAL_CAP}
Current MC: $${CURRENT_CAP}
Called: ${FIRST_CALLED_AT_UTC}
⏫ Still moving — watch closely.
```

* Markdown enabled, emojis allowed.
* One message per milestone crossing.
* Sent simultaneously to the group owning that token.
* **Custom milestone labels** from database (e.g., "2×", "🚀 5×", "10×").

---

## 9) Configuration (ENV)

```
POLL_INTERVAL_SECONDS=60
MARKET_CAP_PROVIDER=coingecko|cmc|birdeye
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
TG_BOT_TOKEN=...
TG_CHAT_ID_FSM=...
TG_CHAT_ID_ISSAM=...
CMC_API_KEY=...
BIRDEYE_API_KEY=...
```

> **Note**: Milestones are now configured dynamically in the `milestones_config` table instead of environment variables.

---

## 10) Deployment & Ops

* **Railway** runtime, prod only.
* **GitHub Actions** for build / deploy.
* **Endpoints**

  * `/health` → status OK + last cycle timestamp
  * `/stats` → { processed, alertsSent, skipped, errors }

---

## 11) Error Handling

* Retry (3×) on 429 / 5xx for provider & Telegram.
* On final failure: log → continue.
* No data persistence or compensation logic.

---

## 12) Validation

* Use production lists with temporary low thresholds (e.g. +5 %, +10 %).
* Confirm alert within ≤ 60 s of threshold crossing.

---

## 13) Future Extensions

* Multi-chain support (BNB, ETH).
* Discord or webhooks.
* Optional local cache for faster comparisons.
* Historical analytics using a separate writable DB.

---