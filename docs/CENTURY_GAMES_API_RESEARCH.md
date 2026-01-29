# Century Games API Research

**Last Updated:** 2026-01-29  
**Purpose:** Document findings on Century Games gift code API for player data extraction  
**Status:** Research Complete - Ready for Implementation

---

## Executive Summary

Century Games (developer of Kingshot, Whiteout Survival, and other titles) exposes a public API through their gift code redemption websites. This API can be used to:

1. ✅ **Verify player identity** using Player ID
2. ✅ **Extract basic player profile data** (avatar, nickname, kingdom, town center level)
3. ❌ **Extract ranking data** - NOT available through this API (requires in-game access)

---

## Kingshot Gift Code API

### Base URL
```
https://kingshot-giftcode.centurygame.com/api
```

### Authentication Method
All requests require a **signed payload** using MD5 hashing with a secret salt.

#### Secret Salt (Kingshot)
```
mN4!pQs6JrYwV9
```

#### Signature Generation
```javascript
// Sort parameters alphabetically, concatenate as key=value pairs, append salt, MD5 hash
const params = { fid: playerId, time: timestamp };
const sortedKeys = Object.keys(params).sort();
const paramString = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
const signature = md5(paramString + salt);
```

### API Endpoints

#### 1. Player Login/Verification
**Endpoint:** `POST /player`

**Purpose:** Verify player ID and retrieve basic profile information

**Request:**
```
Content-Type: application/x-www-form-urlencoded

fid={player_id}&time={timestamp_ms}&sign={md5_signature}
```

**Response (Success):**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "fid": "123456789",
    "nickname": "PlayerName",
    "avatar_image": "https://cdn.centurygame.com/avatars/xxx.png",
    "kid": 172,
    "stove_lv": 30,
    "stove_lv_content": "Town Center Level: 30",
    "total_recharge_amount": 0
  }
}
```

**Data Fields Returned:**
| Field | Description | Use Case |
|-------|-------------|----------|
| `fid` | Player ID | Unique identifier |
| `nickname` | In-game username | Display name |
| `avatar_image` | Profile picture URL | User avatar |
| `kid` | Kingdom ID | Kingdom identification |
| `stove_lv` | Town Center Level | Player progression |
| `total_recharge_amount` | Total spending | (Internal use) |

#### 2. Gift Code Redemption
**Endpoint:** `POST /gift_code`

**Purpose:** Redeem a gift code for rewards

**Request:**
```
Content-Type: application/x-www-form-urlencoded

fid={player_id}&cdk={gift_code}&time={timestamp_ms}&sign={md5_signature}
```

**Note:** May require CAPTCHA verification first via `/captcha` endpoint.

**Response Codes:**
| err_code | Meaning |
|----------|---------|
| 20000 | SUCCESS |
| 40005 | Code already used |
| 40007 | Code expired |
| 40008 | Already received by this player |
| 40011 | Already received (alternate) |
| 40014 | Code not found |
| 40101 | CAPTCHA check too frequent |
| 40103 | CAPTCHA error |

---

## Implementation Guide for Kingshot Atlas

### Use Case: Player Profile Auto-Population

When a user wants to link their Kingshot account to Kingshot Atlas:

```typescript
// Frontend: Player verification flow
async function verifyKingshotPlayer(playerId: string): Promise<PlayerData | null> {
  const timestamp = Date.now().toString();
  const salt = 'mN4!pQs6JrYwV9';
  
  // Generate signature
  const paramString = `fid=${playerId}&time=${timestamp}`;
  const signature = md5(paramString + salt);
  
  const response = await fetch('https://kingshot-giftcode.centurygame.com/api/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `fid=${playerId}&time=${timestamp}&sign=${signature}`,
  });
  
  const data = await response.json();
  
  if (data.code === 0 && data.data) {
    return {
      playerId: data.data.fid,
      username: data.data.nickname,
      avatarUrl: data.data.avatar_image,
      kingdom: data.data.kid,
      townCenterLevel: data.data.stove_lv,
    };
  }
  
  return null;
}
```

### Rate Limiting Considerations

Based on observed behavior:
- **Cooldown:** 1 second between requests recommended
- **429 Response:** Wait 11 seconds before retry
- **Max Retries:** 3-4 attempts with exponential backoff

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      await sleep(11000); // Wait 11 seconds on rate limit
      continue;
    }
    
    return response;
  }
  throw new Error('Max retries exceeded');
}
```

---

## Whiteout Survival API (Reference)

For comparison, the Whiteout Survival API uses a similar pattern:

### Base URL
```
https://wos-giftcode-api.centurygame.com/api
```

### Secret Salt (WOS)
```
tB87#kPtkxqOS2
```

### Same Endpoints
- `/player` - Player verification
- `/gift_code` - Code redemption
- `/captcha` - CAPTCHA generation

---

## Ranking Data Extraction

### Current Status: NOT AVAILABLE via API

The gift code API **does not expose** ranking data such as:
- Alliance Power rankings
- Personal Power rankings
- Rebel Conquest Stage
- Hero's Total Power
- Total Pet Power
- Island Prosperity
- Mystic Trial rankings

### Why Rankings Are Not Available

1. **API Scope:** The gift code API is designed solely for code redemption, not game data access
2. **No Public Game API:** Century Games does not provide a public API for game statistics
3. **Data Location:** Ranking data exists only within the game client and game servers

### Alternative Approaches for Ranking Data

#### Option 1: Manual Data Entry (Current)
- Users manually enter their stats
- Pros: No technical barriers
- Cons: Data accuracy depends on users

#### Option 2: Screenshot OCR (Future)
- Users upload screenshots of rankings
- Use OCR to extract data
- Pros: Verifiable, accurate
- Cons: Requires image processing infrastructure

#### Option 3: Community Data Aggregation
- Partner with alliance leaders who track data
- Import from spreadsheets/Discord bots
- Pros: Bulk data import
- Cons: Requires community coordination

#### Option 4: Game Client Packet Analysis (NOT RECOMMENDED)
- Intercept game client network traffic
- Pros: Real-time data
- Cons: **Violates ToS**, potential account bans, legally risky

---

## Security Considerations

### For Kingshot Atlas Implementation

1. **Proxy API Calls:** Don't expose the secret salt in frontend code
   ```
   Frontend → Kingshot Atlas API → Century Games API
   ```

2. **Rate Limit Protection:** Implement server-side rate limiting to prevent abuse

3. **Data Validation:** Verify returned data before storing

4. **User Consent:** Clearly explain what data is being accessed

### Terms of Service

While the gift code API is publicly accessible and used by the official website, automated bulk access may violate Century Games' terms of service. Recommendations:

- ✅ Single player verification on user request
- ✅ Reasonable rate limiting (1 request per second max)
- ❌ Bulk scraping of player data
- ❌ Automated code redemption services

---

## Implementation Roadmap

### Phase 1: Player Profile Linking (Recommended)
1. Add "Link Kingshot Account" feature
2. User enters their Player ID
3. Verify via API, display profile preview
4. User confirms, data saved to their Atlas profile

### Phase 2: Profile Refresh (Optional)
1. Allow users to refresh their linked profile
2. Rate limit to once per day per user
3. Update avatar, username, kingdom, TC level

### Phase 3: Ranking Data (Future)
1. Implement screenshot upload feature
2. Add OCR processing for ranking screenshots
3. Allow manual stat entry as fallback

---

## Reference Implementations

### Open Source Projects Using This API

1. **Kingshot Redeem Code Tool**
   - GitHub: `Spaced-one/Kingshot-Redeem-Code-All-Alliance-Site`
   - Live: https://spaced-one.github.io/Kingshot-Redeem-Code-All-Alliance-Site/
   - Features: Batch code redemption, player info fetch

2. **Whiteout Survival Autopilot**
   - GitHub: `batazor/whiteout-survival-autopilot`
   - Features: Automated code redemption with CAPTCHA solving

3. **WOS Gift Rewards**
   - GitHub: `Nico31300/wos-245-gift-rewards`
   - Features: Alliance-wide code distribution

---

## Appendix: Full API Request Example

### JavaScript Implementation
```javascript
import CryptoJS from 'crypto-js';

const KINGSHOT_API = 'https://kingshot-giftcode.centurygame.com/api';
const KINGSHOT_SALT = 'mN4!pQs6JrYwV9';

function generateSignature(params, salt) {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  return CryptoJS.MD5(paramString + salt).toString();
}

async function getPlayerInfo(playerId) {
  const timestamp = Date.now().toString();
  const params = { fid: playerId, time: timestamp };
  const sign = generateSignature(params, KINGSHOT_SALT);
  
  const body = new URLSearchParams({
    ...params,
    sign,
  });
  
  const response = await fetch(`${KINGSHOT_API}/player`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: body.toString(),
  });
  
  return response.json();
}

// Usage
const playerData = await getPlayerInfo('123456789');
console.log(playerData);
```

### Python Implementation
```python
import hashlib
import time
import requests

KINGSHOT_API = 'https://kingshot-giftcode.centurygame.com/api'
KINGSHOT_SALT = 'mN4!pQs6JrYwV9'

def generate_signature(params: dict, salt: str) -> str:
    sorted_keys = sorted(params.keys())
    param_string = '&'.join(f'{k}={params[k]}' for k in sorted_keys)
    return hashlib.md5((param_string + salt).encode()).hexdigest()

def get_player_info(player_id: str) -> dict:
    timestamp = str(int(time.time() * 1000))
    params = {'fid': player_id, 'time': timestamp}
    params['sign'] = generate_signature(params, KINGSHOT_SALT)
    
    response = requests.post(
        f'{KINGSHOT_API}/player',
        data=params,
        headers={
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        }
    )
    return response.json()

# Usage
player_data = get_player_info('123456789')
print(player_data)
```

---

*Research conducted by Platform Engineer for Kingshot Atlas integration.*
*Last updated: 2026-01-29*
