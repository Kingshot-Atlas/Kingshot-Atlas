# Data Quality Specialist — Latest Knowledge

**Last Updated:** 2026-01-29  
**Version:** 1.0

---

## Current Data State

### Kingdom Database
- **Total Kingdoms:** 1190
- **Data Source:** Manual gathering + community submissions
- **Last Major Update:** [Check with Platform Engineer]

### Known Data Quality Issues
- No automated validation pipeline yet
- Community submissions reviewed manually
- No staleness tracking implemented

---

## Validation Rules

### Kingdom Required Fields
```
- kingdom_id (unique, positive integer)
- kingdom_name (string, non-empty)
- power_level (positive integer)
- tier (S, A, B, C, D, F)
- region (valid region code)
```

### Atlas Score Components
- Power metrics
- Activity metrics  
- KvK performance history
- Community engagement factors

### Suspicious Value Ranges
| Field | Expected Range | Flag If |
|-------|----------------|---------|
| Power Level | 1B - 500B | Outside range |
| Win Rate | 0% - 100% | >100% or negative |
| KvK Count | 0 - 50+ | Negative |

---

## Tools & Resources

### Validation Scripts
- Location: `/apps/api/validators/` (to be created)
- Language: Python
- Framework: Pydantic for schema validation

### Data Sources
- Primary: Supabase PostgreSQL
- Submissions: TBD submission system

### Quality Dashboards
- TBD: Quality metrics dashboard

---

## Patterns & Best Practices

### Data Import
1. Always validate before import
2. Use transactions for atomicity
3. Log all changes with timestamps
4. Keep backup of previous state

### Submission Review
1. Check submitter history
2. Cross-reference multiple sources when possible
3. When uncertain, flag for admin review
4. Provide clear feedback on rejections

---

## Current Priorities

1. **Establish validation schema** — Define all required fields and constraints
2. **Create staleness tracking** — Flag kingdoms with old data
3. **Build submission workflow** — Structured review process
4. **Quality metrics dashboard** — Visibility into data health

---

## Gotchas

### Known Issues
- Some legacy kingdom records may have incomplete data
- Power levels can change rapidly during KvK
- Different data sources may use different formats

### Things to Verify
- Atlas Score calculation matches documented formula
- Tier assignments follow documented criteria
- Historical data preserved during updates

---

*Knowledge base for Data Quality Specialist*
