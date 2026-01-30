# Data Quality Scripts

**Owned by:** Data Quality Specialist (Platform Engineer sub-agent)

Scripts for maintaining data integrity per VISION.md principles.

## Available Scripts

### `data_quality_audit.py`

Runs comprehensive data quality checks on the kingdom database.

```bash
# Basic audit
python scripts/data_quality_audit.py

# Verbose output
python scripts/data_quality_audit.py --verbose

# Custom output file
python scripts/data_quality_audit.py -o reports/audit_2026-01-29.json
```

**Checks performed:**
- Required fields present
- Score ranges valid (0-15)
- Win rate calculations match
- Streak values logical
- KvK totals consistent
- Kingdom numbers in range

**Output:** JSON report in `data/quality_report.json`

### `validate_submission.py`

Validates user-submitted kingdom data before database entry.

```bash
# Validate a submission file
python scripts/validate_submission.py submission.json

# Test with sample data
python scripts/validate_submission.py --test
```

**Validation rules:**
- Kingdom number in range (1-2000)
- Win/loss counts reasonable
- Status values valid
- Business logic checks

## Integration

### With CI/CD

Add to your GitHub Actions workflow:

```yaml
- name: Data Quality Check
  run: python apps/api/scripts/data_quality_audit.py
  continue-on-error: false
```

### With API

```python
from scripts.validate_submission import SubmissionValidator

validator = SubmissionValidator()
result = validator.validate(request_data)

if not result.valid:
    return {"error": result.errors}, 400
```

## Quality Metrics

| Metric | Target | Action if Below |
|--------|--------|-----------------|
| Quality Score | >90 | Review issues |
| Critical Issues | 0 | Immediate fix |
| Warnings | <50 | Schedule review |

## Schedule

- **Daily:** Automated audit at 03:00 UTC (after daily updates)
- **On submission:** Real-time validation
- **Weekly:** Manual review of warning trends
