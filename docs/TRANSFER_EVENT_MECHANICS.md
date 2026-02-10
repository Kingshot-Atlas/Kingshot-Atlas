# Transfer Event Mechanics

**Last Updated:** 2026-01-30  
**Purpose:** Reference document for Transfer Event rules and constraints

---

## Schedule

- **Frequency:** Every 8 weeks
- **Reference:** Transfer Event #3 started Sunday, January 4, 2026 at 00:00 UTC

### Phases

| Phase | Duration | Description |
|-------|----------|-------------|
| **Pre-Transfer** | Sun 00:00 → Wed 00:00 UTC | Preparation period |
| **Invitational Transfer** | Wed 00:00 → Fri 00:00 UTC | Invitation-based transfers |
| **Open Transfer** | Fri 00:00 → Sun 00:00 UTC | First-come, first-served |

---

## Invitational Transfer Phase

Kings/Managers can send invites during this phase.

### Slot Limits

| Kingdom Type | Regular Invites | Special Invites | Open Slots | Power Cap |
|--------------|-----------------|-----------------|------------|-----------|
| **Leading** | 20 | 0 | 10 | Lower — restricts high-power transferees |
| **Ordinary** | 35 | 3 | 20 | Higher — accepts more powerful players |

### Special Invites (Ordinary Kingdoms Only)

- Allow strong players who exceed the power cap to join
- Maximum of 3 special invites at any time
- Replenish: 1 new invite on the 1st of each month at 00:00 UTC

### Key Rules

- Transfer Managers can send **unlimited invites**, but only the slot cap can actually join
- Players still need **Transfer Passes** (1–50 depending on Power)
- Best strategy: Contact Transfer Manager/King during this phase to secure a spot
- Upon transfer: Player moved to a random spot on the world map

---

## Open Transfer Phase

Final chance to transfer — **first come, first served**.

### Slot Limits

| Kingdom Type | Available Slots |
|--------------|-----------------|
| **Leading** | 10 |
| **Ordinary** | 20 |

### Key Rules

- Be ready at **00:00 UTC on Friday** to secure a spot
- Transfer Passes still required (typically fewer than 10 for F2P players)
- Slots fill quickly — timing is critical

---

## Transfer Passes

Required for all transfers, regardless of phase.

| Player Power | Passes Required |
|--------------|-----------------|
| Low power (F2P) | 1–10 |
| Medium power | 10–30 |
| High power | 30–50 |

*Exact formula TBD — needs research*

---

## Transfer Groups

Each Transfer Event groups kingdoms into **transfer groups**. Players from a given kingdom can **only transfer to other kingdoms within the same transfer group**. Transfer groups change every event and are announced shortly before the event begins.

### How It Works

1. Kingdoms are divided into numbered ranges (transfer groups)
2. A player in Kingdom X can only transfer to another kingdom in the same group where Kingdom X falls
3. The Transfer Hub must filter listings so users only see kingdoms in their transfer group
4. Groups are configured per event — they are **not permanent**

### Last Transfer Event Groups (Reference)

| Group | Kingdom Range |
|-------|---------------|
| 1 | Kingdoms 1 – 6 |
| 2 | Kingdoms 7 – 115 |
| 3 | Kingdoms 116 – 417 |
| 4 | Kingdoms 418 – 587 |
| 5 | Kingdoms 588 – 674 |
| 6 | Kingdoms 675 – 846 |

**Example:** A player in Kingdom 172 could only transfer to kingdoms 116–417 (Group 3).

### Implementation Notes

- Transfer groups are stored as a frontend config (`TRANSFER_GROUPS` array of `[min, max]` ranges)
- When groups for the new event are announced, update the config and set `TRANSFER_GROUPS_ACTIVE = true`
- When no active event, set `TRANSFER_GROUPS_ACTIVE = false` to show all kingdoms
- The user's linked kingdom determines which group they belong to
- Users without a linked kingdom see all kingdoms (no filtering)

---

## Strategic Considerations

### For Players Looking to Transfer

1. **Invitational Phase is safer** — Secure a spot before Open chaos
2. **Contact kingdoms early** — Build relationships before the event
3. **Verify kingdom claims** — Use Atlas to fact-check recruitment promises
4. **Calculate pass requirements** — Don't be caught short

### For Kingdoms Recruiting

1. **Leading kingdoms have fewer slots** — Be selective, 20 Invitational + 10 Open
2. **Ordinary kingdoms have more flexibility** — 35+3 Invitational + 20 Open
3. **Special invites are precious** — Only 3 max, use wisely for whales
4. **Vet incoming players** — Avoid dead weight or spies

---

## Data Points Relevant to Transfer Decisions

### What Players Want to Know

- Kingdom strength (Atlas Score, tier)
- KvK performance (win rate, recent results)
- Activity level
- Leadership quality
- Alliance structure
- Power requirements to join

### What Kingdoms Want to Know

- Player power and growth potential
- Activity level and engagement
- KvK participation history
- Reason for leaving current kingdom
- Alliance/group affiliations

---

*This document informs Transfer Event feature development.*
