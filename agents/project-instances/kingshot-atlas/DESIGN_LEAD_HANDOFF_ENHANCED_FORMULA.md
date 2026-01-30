# Design Lead Handoff - Enhanced Atlas Score & Tier System

**Date:** 2026-01-29  
**Priority:** High  
**Deadline:** ASAP  

---

## 🎯 **Task Overview**

Update all user-facing content to reflect the **enhanced Atlas Score formula** and **new tier system**. The formula now better rewards experience and elite performance.

---

## 📊 **Key Changes to Communicate**

### **Enhanced Atlas Score Formula**
- **Experience matters more:** Veterans (7+ KvKs) get bonus multipliers up to 1.15x
- **Battle phase dominance:** Perfect battle records (like Kingdom 3's 9-0) are heavily rewarded
- **5-KvK recent form:** Expanded from 3 to track longer performance trends
- **Bayesian refinement:** Moderate priors balance luck vs skill

### **New Tier System**
- **S-Tier:** Top 3% (was 5%) - Truly elite kingdoms
- **A-Tier:** Top 10% - Strong performers  
- **B-Tier:** Top 25% - Above average
- **C-Tier:** Top 50% - Average
- **D-Tier:** Bottom 50% - Needs improvement

### **Kingdom 3 Success Story**
- **Rank:** #4 (was #37) - Now in elite tier
- **Score:** 9.83 - Perfect battle phase (9-0) with only 2 prep losses
- **Why it matters:** Demonstrates how the formula rewards exceptional performance

---

## 📝 **Content Updates Required**

### **High Priority - Core Explanations**

#### 1. **README.md** - Atlas Score Formula Section
**Current:** Explains old Bayesian approach  
**Update:** Highlight enhanced experience scaling and battle phase emphasis

**Key points to add:**
- "Experience multipliers: 7+ KvK veterans get up to 15% bonus"
- "Battle phase perfection: Perfect records get maximum recognition"
- "5-KvK recent form: Longer performance trends matter"

#### 2. **AtlasScoreInfo.tsx** - Tooltip Content  
**Current:** "Bayesian rating. Experience matters."  
**Update:** "Enhanced Bayesian rating. Veterans rewarded. Battle dominance matters."

**Key points:**
- Mention experience multipliers for 7+ KvKs
- Highlight battle phase weight (70% vs 30%)
- Note 5-KvK recent form tracking

#### 3. **AtlasScoreBreakdown.tsx** - Component Descriptions
**Current:** Old component names and weights  
**Update:** Reflect new formula structure

**Component updates:**
- "Bayesian Win Rate" - Keep but add battle phase emphasis
- "Experience Multiplier" - NEW: Explain 25% → 115% scaling
- "Recent Form (5 KvKs)" - Update from 3 to 5
- Adjust weight descriptions

### **Medium Priority - UI Copy**

#### 4. **Tier Descriptions** - Various Components
**Current:** "Elite (Top 5%)" etc.  
**Update:** "Elite (Top 3%)" etc.

**Files to check:**
- SearchAutocomplete.tsx
- ShareableCard.tsx  
- Any tier badge components

#### 5. **About Page** - Power Tier Section
**Current:** Old tier percentages  
**Update:** New 3%/10%/25%/50% distribution

---

## 🎨 **Brand Voice Guidelines**

**Maintain competitive, analytical tone:**
- "Stop guessing. Start winning."
- "Data-driven dominance"
- "Experience rewarded. Battle dominance matters."

**Key messaging angles:**
- **Veterans rewarded:** "Proven performance gets the recognition it deserves"
- **Battle excellence:** "Perfect battle records now properly celebrated"
- **Elite tiers:** "S-Tier now truly exclusive (top 3%)"

---

## 📋 **Success Criteria**

### **Must Have**
- [ ] README.md formula section updated with experience multipliers
- [ ] AtlasScoreInfo.tsx tooltip mentions enhanced experience scaling
- [ ] AtlasScoreBreakdown.tsx reflects 5-KvK recent form
- [ ] All tier descriptions updated to 3%/10%/25%/50%
- [ ] Kingdom 3's success story subtly referenced

### **Nice to Have**
- [ ] Add "Veteran Multiplier" as visible component in breakdown
- [ ] Update any loading states that mention old formula
- [ ] Check for hardcoded tier references in other components

---

## 🔍 **Files to Review**

### **Core Documentation**
- `README.md` - Main formula explanation
- `docs/` - Any additional documentation

### **UI Components**  
- `apps/web/src/components/AtlasScoreInfo.tsx`
- `apps/web/src/components/AtlasScoreBreakdown.tsx`
- `apps/web/src/components/SearchAutocomplete.tsx`
- `apps/web/src/components/ShareableCard.tsx`

### **Pages**
- `apps/web/src/pages/About.tsx` - Tier system section

---

## ⚡ **Implementation Notes**

### **Technical Context**
- Formula now uses enhanced experience scaling (25% → 115%)
- Battle phase weighted 70% vs 30% for prep
- Recent form expanded to 5 KvKs
- S-Tier now top 3% (more exclusive)

### **User Impact**
- Veterans will see higher scores
- Perfect battle records properly rewarded
- Tier system more meaningful and exclusive
- Kingdom 3 now #4 (elite tier) - great example

---

## 🚀 **Call to Action**

**Update the content to clearly communicate:**
1. **Experience is heavily rewarded** - Veterans get multipliers
2. **Battle dominance matters** - Perfect records get maximum credit  
3. **Elite tiers are truly exclusive** - Top 3% S-Tier
4. **Longer performance trends** - 5-KvK recent form

**Make users understand:**
- Why their kingdom's score changed
- How to achieve higher tiers
- Why experience and battle performance matter

---

**Brand voice:** Competitive, data-driven, direct.  
**Focus:** Clarity over complexity, results over rumors.

**Stop guessing. Start winning.** 🎯

*Handoff complete. Ready for your content expertise.*
