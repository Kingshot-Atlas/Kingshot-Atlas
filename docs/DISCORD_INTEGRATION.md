# Discord Integration Architecture

## Overview

Connect Kingshot Atlas website with the Discord server to automatically sync roles, achievements, and status based on user actions.

## Integration Points

### 1. Atlas Supporter Subscribers
**Trigger:** User purchases Atlas Supporter subscription via Stripe ($4.99/mo or $49.99/yr)
**Discord Role:** `Supporter` (cyan color, #22d3ee)
**Implementation:**
- Stripe webhook → Backend API → Discord Bot grants role
- Requires user to have linked Discord account
- `syncSupporterRoles()` runs every 30min as periodic sync

### 2. Ambassador Network (Referral Program)
**Trigger:** User reaches referral tier thresholds (Scout 2+, Recruiter 5+, Consul 10+, Ambassador 20+)
**Discord Role:** Consul and Ambassador tiers get Discord roles
**Implementation:**
- Referral tracking in `referrals` table with anti-gaming protections
- Discord bot auto-syncs Consul/Ambassador roles every 30min

### 3. Data Contributors (NEW)
**Trigger:** User reaches 25 approved data contributions (Atlas Legend badge)
**Discord Role:** See role name options below
**Implementation:**
- contributorService tracks approved count
- When `atlas_legend` badge earned → API call → Discord Bot grants role

---

## Discord Role Name Options for Data Contributors

### Recommended Names:
| Name | Rationale |
|------|-----------|
| **Atlas Archivist** | Professional, fits the "keeper of data" theme |
| **Data Guardian** | Heroic, emphasizes protecting data integrity |
| **Chronicle Keeper** | Lore-friendly, fits kingdom fantasy theme |
| **Atlas Cartographer** | Maps/data connection, scholarly feel |
| **Intel Elite** | Military/competitive gaming vibe |

### Alternative Names:
- **Data Legend** - Simple, matches badge name
- **Atlas Historian** - Academic, data preservation angle
- **Kingdom Chronicler** - Fantasy theme consistency
- **Intel Commander** - Military rank progression feel
- **Realm Recorder** - Fantasy + data theme

### My Top Pick: **Atlas Archivist**
- Unique and memorable
- Professional without being boring
- Connects to the "Atlas" brand
- Implies authority over data/records

---

## Technical Architecture

### Option A: Discord OAuth2 + Bot (Recommended)

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Kingshot Atlas │────▶│  Backend API │────▶│ Discord Bot │
│    Website      │     │   (Render)   │     │  (Render)   │
└─────────────────┘     └──────────────┘     └─────────────┘
        │                       │                    │
        │                       │                    ▼
        ▼                       ▼              ┌──────────┐
   ┌─────────┐            ┌──────────┐         │ Discord  │
   │ Supabase│            │  Stripe  │         │  Server  │
   │  Auth   │            │ Webhooks │         └──────────┘
   └─────────┘            └──────────┘
```

**Flow:**
1. User links Discord account on website (OAuth2)
2. Store Discord user ID in Supabase profiles table
3. When trigger event occurs (purchase, badge earned, etc.):
   - Backend API calls Discord Bot
   - Bot assigns role via Discord API
4. Bot can also sync roles on member join (check existing badges)

### Option B: Direct Discord API (Simpler but less flexible)

- Backend directly calls Discord API using bot token
- No separate bot service needed
- Harder to extend with other bot features

---

## Database Schema Additions

```sql
-- Add to profiles table
ALTER TABLE profiles ADD COLUMN discord_id TEXT;
ALTER TABLE profiles ADD COLUMN discord_username TEXT;
ALTER TABLE profiles ADD COLUMN discord_linked_at TIMESTAMPTZ;

-- Contributor stats table (server-side tracking)
CREATE TABLE contributor_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  total_pending INTEGER DEFAULT 0,
  reputation INTEGER DEFAULT 100,
  badges TEXT[] DEFAULT '{}',
  discord_role_synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role sync log
CREATE TABLE discord_role_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  discord_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  action TEXT NOT NULL, -- 'add' or 'remove'
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Implementation Phases

### Phase 1: Foundation (This Sprint)
1. ✅ Add contributor badge tiers (Scout, Hunter, Master, Legend)
2. ⏳ Add `discord_id` column to profiles
3. ⏳ Create Discord OAuth2 link flow on website
4. ⏳ Update Discord bot to accept role-grant API calls

### Phase 2: Supporter Subscriber Sync ✅
1. Stripe webhook handler → check if user has Discord linked
2. If yes, call Discord bot to grant `Supporter` role
3. Handle subscription cancellation (remove role)

### Phase 3: Contributor Sync
1. When `atlas_legend` badge earned, trigger role sync
2. Call Discord bot to grant `Atlas Archivist` role
3. Display "Discord role unlocked!" notification on website

### Phase 4: Advanced Features
- Auto-sync all roles on Discord server join
- Display Discord connection status on profile
- "Verify on Discord" button that opens OAuth flow
- Bot command: `/verify` to check role eligibility

---

## Environment Variables Needed

```bash
# Discord Bot (already exists in apps/discord-bot)
DISCORD_BOT_TOKEN=xxx
DISCORD_GUILD_ID=xxx

# New: For role management
DISCORD_ATLAS_PRO_ROLE_ID=xxx
DISCORD_ATLAS_RECRUITER_ROLE_ID=xxx  
DISCORD_ATLAS_ARCHIVIST_ROLE_ID=xxx  # Data contributors

# Website OAuth2 (new)
DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=xxx
DISCORD_REDIRECT_URI=https://ks-atlas.com/auth/discord/callback
```

---

## Security Considerations

1. **Never expose bot token to frontend**
2. **Validate all role grants server-side** - check actual badge/subscription status
3. **Rate limit role sync calls** - prevent abuse
4. **Log all role changes** - audit trail
5. **Handle Discord API errors gracefully** - retry logic for temporary failures

---

## User Experience Flow

### Linking Discord Account
1. User goes to Profile → Settings
2. Clicks "Link Discord Account"
3. Redirected to Discord OAuth2
4. Authorizes Kingshot Atlas app
5. Redirected back with Discord ID stored
6. Any existing role eligibility is synced immediately

### Earning Data Contributor Role
1. User submits 25 data contributions
2. All get approved over time
3. On 25th approval, `atlas_legend` badge is earned
4. If Discord is linked:
   - API triggers role grant
   - User sees "Discord role unlocked!" toast
   - Role appears in Discord server
5. If Discord NOT linked:
   - Show prompt: "Link Discord to claim your Atlas Archivist role!"
