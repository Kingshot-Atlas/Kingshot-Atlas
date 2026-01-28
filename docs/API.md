# Kingshot Atlas API Documentation

Base URL: `http://127.0.0.1:8000/api`

Interactive docs: `http://127.0.0.1:8000/docs` (Swagger UI)

---

## Kingdoms

### List Kingdoms
```
GET /api/kingdoms
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by kingdom number |
| `status` | string | Filter by status (Leading, Ordinary, Unannounced) |
| `min_kvks` | int | Minimum total KVKs |
| `min_prep_wr` | float | Minimum prep win rate (0-1) |
| `min_battle_wr` | float | Minimum battle win rate (0-1) |
| `sort` | string | Sort field (kingdom_number, overall_score, prep_win_rate, battle_win_rate) |
| `order` | string | Sort order (asc, desc) |

**Response:** `Kingdom[]`

**Example:**
```bash
curl "http://127.0.0.1:8000/api/kingdoms?search=1001"
curl "http://127.0.0.1:8000/api/kingdoms?min_kvks=5&sort=overall_score&order=desc"
```

---

### Get Kingdom Profile
```
GET /api/kingdoms/{kingdom_number}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `kingdom_number` | int | Kingdom ID |

**Response:** `KingdomProfile` (includes recent KVKs)

**Example:**
```bash
curl "http://127.0.0.1:8000/api/kingdoms/1001"
```

---

## Leaderboard

### Get Leaderboard
```
GET /api/leaderboard
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort_by` | string | overall_score | Sort field |
| `limit` | int | 50 | Results to return |
| `offset` | int | 0 | Results to skip |

**Valid sort_by values:** `overall_score`, `prep_win_rate`, `battle_win_rate`, `total_kvks`, `kingdom_number`

**Response:** `Kingdom[]`

**Example:**
```bash
curl "http://127.0.0.1:8000/api/leaderboard?sort_by=battle_win_rate&limit=10"
```

---

### Get Leaderboard by Status
```
GET /api/leaderboard/top-by-status
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | Yes | Status filter |
| `limit` | int | No (10) | Results per status |

**Response:**
```json
{
  "status": "Leading",
  "kingdoms": [...]
}
```

---

## Compare

### Compare Kingdoms
```
GET /api/compare
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `kingdoms` | string | Comma-separated kingdom numbers (2-5) |

**Response:**
```json
{
  "kingdoms": [
    { "kingdom": {...}, "recent_kvks": [...] }
  ],
  "comparison_summary": {
    "total_kingdoms": 2,
    "avg_overall_score": 8.5,
    "avg_prep_wr": 0.65,
    "avg_battle_wr": 0.70,
    "top_kingdom": {...},
    "best_prep_wr": {...},
    "best_battle_wr": {...}
  }
}
```

**Example:**
```bash
curl "http://127.0.0.1:8000/api/compare?kingdoms=1001,1002,1003"
```

---

### Head-to-Head Comparison
```
GET /api/compare/head-to-head
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `kingdom1` | int | First kingdom number |
| `kingdom2` | int | Second kingdom number |

**Response:**
```json
{
  "kingdoms": [...],
  "direct_matches": [...],
  "head_to_head_record": {
    "kingdom_1001_wins": 2,
    "kingdom_1002_wins": 1,
    "total_matches": 3
  }
}
```

**Example:**
```bash
curl "http://127.0.0.1:8000/api/compare/head-to-head?kingdom1=1001&kingdom2=1002"
```

---

## Data Models

### Kingdom
```typescript
interface Kingdom {
  kingdom_number: number;
  total_kvks: number;
  prep_wins: number;
  prep_losses: number;
  prep_win_rate: number;      // 0-1
  prep_streak: number;        // positive = wins, negative = losses
  battle_wins: number;
  battle_losses: number;
  battle_win_rate: number;    // 0-1
  battle_streak: number;
  most_recent_status: string; // Leading, Ordinary, Unannounced
  overall_score: number;      // Weighted score
  rank?: number;              // Calculated rank
  last_updated: string;       // ISO timestamp
  recent_kvks?: KVKRecord[];
}
```

### KVKRecord
```typescript
interface KVKRecord {
  id: number;
  kingdom_number: number;
  kvk_number: number;
  opponent_kingdom: number;
  prep_result: string;        // W, L
  battle_result: string;      // W, L
  overall_result: string;     // Win, Loss, Battle, Prep
  date_or_order_index: string;
  created_at: string;
}
```

---

## Error Responses

All errors return JSON:
```json
{
  "detail": "Error message here"
}
```

**Common HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad request (invalid parameters) |
| 404 | Resource not found |
| 422 | Validation error |
| 429 | Rate limited |
| 500 | Server error |

---

## Rate Limiting

API requests are rate-limited to prevent abuse:
- **100 requests per minute** per IP address

Rate limit headers are included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
