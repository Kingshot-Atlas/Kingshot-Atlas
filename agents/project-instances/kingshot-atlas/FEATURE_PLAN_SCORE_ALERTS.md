# Feature Implementation Plan: Score Alert Notifications

**Feature:** "Score Alert" Notifications (Pro Feature)  
**Assigned To:** Platform Engineer + Product Engineer  
**Priority:** MEDIUM-HIGH  
**Revenue Impact:** $1,996/mo potential (400 Pro users × $4.99)  
**Date:** 2026-01-29

---

## Executive Summary

Users want to know when tracked kingdoms rise/fall in rankings. The new formula creates more dynamic rank changes, making alerts more valuable. Notifications via Discord webhook and/or email.

---

## Goals

- [ ] Allow Pro users to set alerts on watched kingdoms
- [ ] Detect significant score/rank changes after KvK processing
- [ ] Send notifications via Discord webhook
- [ ] Optional email notifications
- [ ] Gate behind Pro subscription

---

## Technical Specification

### 1. Database Schema (Platform Engineer)

**New Table: `score_alerts`**

```sql
CREATE TABLE score_alerts (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,  -- Supabase user ID
    kingdom_number INTEGER NOT NULL REFERENCES kingdoms(kingdom_number),
    
    -- Alert configuration
    alert_type TEXT NOT NULL,  -- 'rank_change', 'score_change', 'tier_change'
    threshold INTEGER,  -- e.g., rank change of 5 or more
    
    -- Notification channels
    discord_webhook_url TEXT,
    email_enabled BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, kingdom_number, alert_type)
);

CREATE INDEX idx_alerts_user ON score_alerts(user_id);
CREATE INDEX idx_alerts_kingdom ON score_alerts(kingdom_number);
CREATE INDEX idx_alerts_active ON score_alerts(is_active) WHERE is_active = true;
```

**New Table: `alert_history`**

```sql
CREATE TABLE alert_history (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES score_alerts(id),
    kingdom_number INTEGER NOT NULL,
    
    -- Change details
    old_score FLOAT,
    new_score FLOAT,
    old_rank INTEGER,
    new_rank INTEGER,
    change_type TEXT,  -- 'improved', 'declined'
    
    -- Delivery
    notification_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    channel TEXT,  -- 'discord', 'email'
    
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Backend Implementation (Platform Engineer)

**New Module:** `/apps/api/alerts/`

```
/apps/api/
├── alerts/
│   ├── __init__.py
│   ├── models.py          # SQLAlchemy models
│   ├── schemas.py         # Pydantic schemas
│   ├── router.py          # API endpoints
│   ├── service.py         # Alert processing logic
│   └── notifications.py   # Discord/email senders
```

**API Endpoints:**

```python
# router.py
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

@router.get("/")
async def list_alerts(user_id: str):
    """List user's configured alerts"""
    pass

@router.post("/")
async def create_alert(alert: AlertCreate, user_id: str):
    """Create new score alert (Pro only)"""
    pass

@router.delete("/{alert_id}")
async def delete_alert(alert_id: int, user_id: str):
    """Delete an alert"""
    pass

@router.put("/{alert_id}/toggle")
async def toggle_alert(alert_id: int, user_id: str):
    """Enable/disable an alert"""
    pass

@router.get("/history")
async def get_alert_history(user_id: str, limit: int = 20):
    """Get history of triggered alerts"""
    pass
```

**Alert Processing Service:**

```python
# service.py
class AlertService:
    
    async def process_score_changes(self, changes: List[ScoreChange]):
        """Called after KvK processing - check all alerts"""
        
        for change in changes:
            # Find all alerts for this kingdom
            alerts = await self.get_active_alerts(change.kingdom_number)
            
            for alert in alerts:
                if self.should_trigger(alert, change):
                    await self.send_notification(alert, change)
                    await self.log_alert_history(alert, change)
    
    def should_trigger(self, alert: Alert, change: ScoreChange) -> bool:
        """Check if alert threshold is met"""
        
        if alert.alert_type == 'rank_change':
            rank_diff = abs(change.old_rank - change.new_rank)
            return rank_diff >= alert.threshold
            
        elif alert.alert_type == 'score_change':
            score_diff = abs(change.old_score - change.new_score)
            return score_diff >= alert.threshold
            
        elif alert.alert_type == 'tier_change':
            old_tier = get_tier(change.old_score)
            new_tier = get_tier(change.new_score)
            return old_tier != new_tier
        
        return False
```

**Discord Notification:**

```python
# notifications.py
import httpx

async def send_discord_alert(webhook_url: str, alert_data: dict):
    """Send formatted Discord embed"""
    
    embed = {
        "title": f"🔔 Kingdom {alert_data['kingdom_number']} Score Alert",
        "description": alert_data['message'],
        "color": 0x22d3ee if alert_data['change_type'] == 'improved' else 0xef4444,
        "fields": [
            {"name": "Old Score", "value": f"{alert_data['old_score']:.1f}", "inline": True},
            {"name": "New Score", "value": f"{alert_data['new_score']:.1f}", "inline": True},
            {"name": "Change", "value": f"{alert_data['score_change']:+.1f}", "inline": True},
            {"name": "Old Rank", "value": f"#{alert_data['old_rank']}", "inline": True},
            {"name": "New Rank", "value": f"#{alert_data['new_rank']}", "inline": True},
            {"name": "Movement", "value": f"{alert_data['rank_change']:+d} spots", "inline": True},
        ],
        "footer": {"text": "Kingshot Atlas • Score Alerts"},
        "timestamp": datetime.utcnow().isoformat()
    }
    
    async with httpx.AsyncClient() as client:
        await client.post(webhook_url, json={"embeds": [embed]})
```

### 3. Integration with KvK Processing (Platform Engineer)

**Update:** `/regenerate_kingdoms_with_atlas_score.py`

```python
from alerts.service import AlertService

async def process_kvk_results():
    # ... existing processing ...
    
    # After score recalculation
    score_changes = []
    for kingdom in updated_kingdoms:
        score_changes.append(ScoreChange(
            kingdom_number=kingdom.number,
            old_score=kingdom.previous_score,
            new_score=kingdom.overall_score,
            old_rank=kingdom.previous_rank,
            new_rank=kingdom.current_rank,
        ))
    
    # Process alerts
    alert_service = AlertService()
    await alert_service.process_score_changes(score_changes)
```

### 4. Frontend Components (Product Engineer)

**New Files:**

```
/apps/web/src/components/
├── Alerts/
│   ├── AlertManager.tsx        # Main alert management UI
│   ├── AlertCard.tsx           # Individual alert display
│   ├── CreateAlertModal.tsx    # New alert form
│   ├── AlertHistory.tsx        # Past triggered alerts
│   └── DiscordWebhookSetup.tsx # Webhook configuration
```

**AlertManager.tsx:**
```typescript
interface AlertManagerProps {
  kingdomNumber: number;
  isPro: boolean;
}

function AlertManager({ kingdomNumber, isPro }: AlertManagerProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  if (!isPro) {
    return <AlertsTeaser />;
  }
  
  return (
    <div className="alert-manager">
      <h3>Score Alerts</h3>
      <p>Get notified when this kingdom's score changes</p>
      
      {alerts.map(alert => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
      
      <button onClick={() => setShowCreateModal(true)}>
        + Add Alert
      </button>
      
      {showCreateModal && (
        <CreateAlertModal
          kingdomNumber={kingdomNumber}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
```

**CreateAlertModal.tsx:**
```typescript
// Alert types:
// 1. Rank changes by X positions
// 2. Score changes by X points
// 3. Tier changes (S-tier to A-tier, etc.)

// Notification options:
// 1. Discord webhook (paste URL)
// 2. Email (to account email)
```

### 5. Premium Gating

**Update:** `/apps/web/src/contexts/PremiumContext.tsx`

```typescript
// Add to PremiumFeatures interface
scoreAlerts: boolean;
maxAlerts: number;

// In TIER_FEATURES:
anonymous: { scoreAlerts: false, maxAlerts: 0, ... },
free: { scoreAlerts: false, maxAlerts: 0, ... },
pro: { scoreAlerts: true, maxAlerts: 10, ... },
recruiter: { scoreAlerts: true, maxAlerts: 50, ... },
```

---

## Implementation Steps

### Phase 1: Database & Backend (Platform Engineer)
1. Create database migrations for `score_alerts` and `alert_history`
2. Create alert service module
3. Implement Discord webhook notifications
4. Add API endpoints for alert CRUD
5. Integrate with KvK processing pipeline
6. Test alert triggering

### Phase 2: Frontend (Product Engineer)
1. Create `AlertManager.tsx` component
2. Create `CreateAlertModal.tsx` with form
3. Create `DiscordWebhookSetup.tsx` with instructions
4. Add to `KingdomProfile.tsx` in watchlist section
5. Premium gating and teaser

### Phase 3: Email Integration (Platform Engineer - Optional)
1. Set up email service (SendGrid/Resend)
2. Create email templates
3. Add email notification option
4. Test delivery

---

## Files to Create/Modify

| File | Agent | Action |
|------|-------|--------|
| `/apps/api/alerts/__init__.py` | Platform | Create (new) |
| `/apps/api/alerts/models.py` | Platform | Create (new) |
| `/apps/api/alerts/schemas.py` | Platform | Create (new) |
| `/apps/api/alerts/router.py` | Platform | Create (new) |
| `/apps/api/alerts/service.py` | Platform | Create (new) |
| `/apps/api/alerts/notifications.py` | Platform | Create (new) |
| `/apps/api/main.py` | Platform | Register router |
| `/regenerate_kingdoms_with_atlas_score.py` | Platform | Add alert processing |
| `/apps/web/src/components/Alerts/*` | Product | Create (new) |
| `/apps/web/src/contexts/PremiumContext.tsx` | Product | Add feature flags |
| `/apps/web/src/pages/KingdomProfile.tsx` | Product | Add alerts section |

---

## Success Criteria

- [ ] Users can create alerts for rank/score/tier changes
- [ ] Discord webhooks fire correctly
- [ ] Alerts trigger after KvK processing
- [ ] Alert history tracked
- [ ] Rate limiting prevents spam
- [ ] Free users see teaser

---

## Discord Webhook Setup Guide (for Users)

```
1. Open Discord → Server Settings → Integrations → Webhooks
2. Click "New Webhook"
3. Name it "Kingshot Atlas Alerts"
4. Copy the webhook URL
5. Paste into Atlas alert setup
6. Test with "Send Test" button
```

---

## Alert Types

| Type | Trigger | Example |
|------|---------|---------|
| Rank Change | Moves X+ positions | "Rank changed by 5+ spots" |
| Score Change | Score changes by X+ | "Score changed by 1.0+ points" |
| Tier Change | Tier boundary crossed | "Dropped from S-tier to A-tier" |

---

## Rate Limiting

- Max 1 alert per kingdom per KvK
- No more than 10 notifications per user per day
- Cooldown of 24 hours between alerts for same kingdom

---

## Dependencies

- KvK processing pipeline
- Discord webhook API
- Premium context
- Watchlist feature (optional integration)

---

## Non-Goals (Out of Scope)

- Push notifications (mobile)
- SMS alerts
- Real-time alerts (batch is fine)
- Alerts for kingdoms not in watchlist

---

**Ready for implementation. Platform Engineer starts with backend, Product Engineer follows with UI.**
