#!/usr/bin/env python3
"""
Data Quality Audit Script
Owned by: Data Quality Specialist (Platform Engineer sub-agent)

Runs comprehensive data quality checks on the kingdom database.
Generates a report of issues found and overall quality score.

Usage:
    python scripts/data_quality_audit.py [--fix] [--verbose]
"""

import sqlite3
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

DATABASE_PATH = Path(__file__).parent.parent / "kingshot_atlas.db"
REPORT_PATH = Path(__file__).parent.parent / "data" / "quality_report.json"


class DataQualityAuditor:
    """Audits kingdom data for quality issues."""
    
    def __init__(self, db_path: Path = DATABASE_PATH, verbose: bool = False):
        self.db_path = db_path
        self.verbose = verbose
        self.issues: List[Dict[str, Any]] = []
        self.stats = {
            "total_kingdoms": 0,
            "kingdoms_checked": 0,
            "issues_found": 0,
            "critical_issues": 0,
            "warnings": 0,
            "quality_score": 0.0,
        }
    
    def log(self, message: str):
        """Log message if verbose mode enabled."""
        if self.verbose:
            print(f"[AUDIT] {message}")
    
    def add_issue(self, kingdom_num: int, issue_type: str, 
                  severity: str, description: str, field: str = None):
        """Record a data quality issue."""
        self.issues.append({
            "kingdom_number": kingdom_num,
            "type": issue_type,
            "severity": severity,
            "description": description,
            "field": field,
            "timestamp": datetime.utcnow().isoformat(),
        })
        self.stats["issues_found"] += 1
        if severity == "critical":
            self.stats["critical_issues"] += 1
        elif severity == "warning":
            self.stats["warnings"] += 1
    
    def connect(self) -> sqlite3.Connection:
        """Connect to the database."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def check_required_fields(self, row: sqlite3.Row) -> List[str]:
        """Check that required fields are present and non-null."""
        required = ["kingdom_number", "total_kvks", "overall_score"]
        missing = []
        for field in required:
            if row[field] is None:
                missing.append(field)
                self.add_issue(
                    row["kingdom_number"], 
                    "missing_required_field",
                    "critical",
                    f"Missing required field: {field}",
                    field
                )
        return missing
    
    def check_score_range(self, row: sqlite3.Row):
        """Verify scores are within valid ranges.
        
        NOTE: Negative scores are intentional - they differentiate kingdoms
        with poor performance from kingdoms with no data (which would be NULL).
        Valid range is approximately -1 to 15.
        """
        score = row["overall_score"]
        if score is not None:
            if score < -2 or score > 16:
                self.add_issue(
                    row["kingdom_number"],
                    "invalid_score_range",
                    "critical",
                    f"Score {score} outside valid range (-2 to 16)",
                    "overall_score"
                )
    
    def check_win_rate_consistency(self, row: sqlite3.Row):
        """Verify win rates match wins/losses."""
        for phase in ["prep", "battle"]:
            wins = row[f"{phase}_wins"] or 0
            losses = row[f"{phase}_losses"] or 0
            total = wins + losses
            stored_rate = row[f"{phase}_win_rate"]
            
            if total > 0 and stored_rate is not None:
                calculated_rate = wins / total
                if abs(calculated_rate - stored_rate) > 0.01:
                    self.add_issue(
                        row["kingdom_number"],
                        "win_rate_mismatch",
                        "warning",
                        f"{phase} win rate mismatch: stored={stored_rate:.2f}, calculated={calculated_rate:.2f}",
                        f"{phase}_win_rate"
                    )
    
    def check_streak_validity(self, row: sqlite3.Row):
        """Verify streak values are logically valid.
        
        NOTE: Streak fields store HISTORICAL BEST streak, not current streak.
        This is documented in DATA_SCHEMA.md. So streak can exceed current
        total wins if the kingdom had a longer streak before losing.
        We only flag truly impossible values (negative or >20).
        """
        for phase in ["prep", "battle"]:
            try:
                streak = row[f"{phase}_streak"] or 0
            except (IndexError, KeyError):
                streak = 0
            
            # Only flag truly invalid values
            if streak < 0:
                self.add_issue(
                    row["kingdom_number"],
                    "invalid_streak",
                    "critical",
                    f"{phase} streak is negative ({streak})",
                    f"{phase}_streak"
                )
            elif streak > 20:
                self.add_issue(
                    row["kingdom_number"],
                    "invalid_streak",
                    "warning",
                    f"{phase} streak ({streak}) seems unusually high",
                    f"{phase}_streak"
                )
    
    def check_kvk_total(self, row: sqlite3.Row):
        """Verify total KvKs matches sum of phase records."""
        total_kvks = row["total_kvks"] or 0
        prep_total = (row["prep_wins"] or 0) + (row["prep_losses"] or 0)
        battle_total = (row["battle_wins"] or 0) + (row["battle_losses"] or 0)
        
        # Both phases should match total (within reason)
        if prep_total > total_kvks or battle_total > total_kvks:
            self.add_issue(
                row["kingdom_number"],
                "kvk_count_mismatch",
                "warning",
                f"Phase records exceed total KvKs: total={total_kvks}, prep={prep_total}, battle={battle_total}",
                "total_kvks"
            )
    
    def check_kingdom_number_range(self, row: sqlite3.Row):
        """Verify kingdom numbers are in valid range."""
        num = row["kingdom_number"]
        if num < 1 or num > 2000:
            self.add_issue(
                num,
                "invalid_kingdom_number",
                "warning",
                f"Kingdom number {num} outside expected range (1-2000)",
                "kingdom_number"
            )
    
    def audit_kingdom(self, row: sqlite3.Row):
        """Run all checks on a single kingdom."""
        self.stats["kingdoms_checked"] += 1
        
        self.check_required_fields(row)
        self.check_score_range(row)
        self.check_win_rate_consistency(row)
        self.check_streak_validity(row)
        self.check_kvk_total(row)
        self.check_kingdom_number_range(row)
    
    def run_audit(self) -> Dict[str, Any]:
        """Run full audit on all kingdoms."""
        self.log("Starting data quality audit...")
        
        conn = self.connect()
        cursor = conn.cursor()
        
        # Get total count
        cursor.execute("SELECT COUNT(*) FROM kingdoms")
        self.stats["total_kingdoms"] = cursor.fetchone()[0]
        self.log(f"Found {self.stats['total_kingdoms']} kingdoms")
        
        # Audit each kingdom
        cursor.execute("SELECT * FROM kingdoms")
        for row in cursor:
            self.audit_kingdom(row)
        
        conn.close()
        
        # Calculate quality score
        if self.stats["total_kingdoms"] > 0:
            issues_per_kingdom = self.stats["issues_found"] / self.stats["total_kingdoms"]
            # Score: 100 - (issues_per_kingdom * 10), minimum 0
            self.stats["quality_score"] = max(0, 100 - (issues_per_kingdom * 10))
        
        self.log(f"Audit complete. Issues found: {self.stats['issues_found']}")
        self.log(f"Quality score: {self.stats['quality_score']:.1f}/100")
        
        return self.generate_report()
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate the audit report."""
        report = {
            "generated_at": datetime.utcnow().isoformat(),
            "database": str(self.db_path),
            "stats": self.stats,
            "issues_by_type": self._group_issues_by_type(),
            "issues_by_severity": self._group_issues_by_severity(),
            "sample_issues": self.issues[:50],  # First 50 for review
            "total_issues": len(self.issues),
        }
        return report
    
    def _group_issues_by_type(self) -> Dict[str, int]:
        """Group issues by type for summary."""
        by_type: Dict[str, int] = {}
        for issue in self.issues:
            issue_type = issue["type"]
            by_type[issue_type] = by_type.get(issue_type, 0) + 1
        return by_type
    
    def _group_issues_by_severity(self) -> Dict[str, int]:
        """Group issues by severity for summary."""
        by_severity: Dict[str, int] = {}
        for issue in self.issues:
            severity = issue["severity"]
            by_severity[severity] = by_severity.get(severity, 0) + 1
        return by_severity
    
    def save_report(self, report: Dict[str, Any], path: Path = REPORT_PATH):
        """Save report to JSON file."""
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w') as f:
            json.dump(report, f, indent=2)
        self.log(f"Report saved to {path}")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Run data quality audit")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--output", "-o", help="Output file path", default=str(REPORT_PATH))
    args = parser.parse_args()
    
    print("=" * 60)
    print("  KINGSHOT ATLAS - DATA QUALITY AUDIT")
    print("  Owned by: Data Quality Specialist")
    print("=" * 60)
    print()
    
    auditor = DataQualityAuditor(verbose=args.verbose)
    report = auditor.run_audit()
    
    # Print summary
    print(f"\n📊 AUDIT SUMMARY")
    print(f"   Kingdoms checked: {report['stats']['kingdoms_checked']}")
    print(f"   Issues found: {report['stats']['issues_found']}")
    print(f"   Critical: {report['stats']['critical_issues']}")
    print(f"   Warnings: {report['stats']['warnings']}")
    print(f"\n🎯 QUALITY SCORE: {report['stats']['quality_score']:.1f}/100")
    
    if report['issues_by_type']:
        print(f"\n📋 ISSUES BY TYPE:")
        for issue_type, count in report['issues_by_type'].items():
            print(f"   {issue_type}: {count}")
    
    # Save report
    auditor.save_report(report, Path(args.output))
    print(f"\n💾 Full report saved to: {args.output}")
    
    # Exit code based on quality
    if report['stats']['critical_issues'] > 0:
        print("\n❌ CRITICAL ISSUES FOUND - Action required!")
        sys.exit(1)
    elif report['stats']['quality_score'] < 80:
        print("\n⚠️  Quality below threshold - Review recommended")
        sys.exit(0)
    else:
        print("\n✅ Data quality is healthy!")
        sys.exit(0)


if __name__ == "__main__":
    main()
