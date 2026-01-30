#!/usr/bin/env python3
"""
Submission Validation Script
Owned by: Data Quality Specialist (Platform Engineer sub-agent)

Validates user-submitted kingdom data before it enters the database.
Implements strict validation rules per VISION.md data integrity principles.

Usage:
    python scripts/validate_submission.py <submission_json>
    
Or import and use programmatically:
    from scripts.validate_submission import SubmissionValidator
    validator = SubmissionValidator()
    result = validator.validate(submission_data)
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field, validator, ValidationError

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class KingdomSubmission(BaseModel):
    """Pydantic model for validating kingdom data submissions."""
    
    kingdom_number: int = Field(..., ge=1, le=2000, description="Kingdom number (1-2000)")
    
    # KvK Results - optional but must be valid if provided
    prep_wins: Optional[int] = Field(None, ge=0, le=100)
    prep_losses: Optional[int] = Field(None, ge=0, le=100)
    battle_wins: Optional[int] = Field(None, ge=0, le=100)
    battle_losses: Optional[int] = Field(None, ge=0, le=100)
    
    # Score - calculated, not submitted
    # overall_score: auto-calculated
    
    # Status
    most_recent_status: Optional[str] = Field(None, max_length=50)
    
    # Metadata
    submitter_id: Optional[str] = Field(None, max_length=100)
    source: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)
    
    @validator('most_recent_status')
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = ['Active', 'Inactive', 'Unknown', 'Merged', 'New']
            if v not in valid_statuses:
                raise ValueError(f"Status must be one of: {valid_statuses}")
        return v
    
    @validator('source')
    def validate_source(cls, v):
        if v is not None:
            valid_sources = ['user_submission', 'admin', 'scrape', 'discord', 'api']
            if v not in valid_sources:
                raise ValueError(f"Source must be one of: {valid_sources}")
        return v


class ValidationResult(BaseModel):
    """Result of a validation check."""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    sanitized_data: Optional[Dict[str, Any]] = None


class SubmissionValidator:
    """Validates kingdom data submissions."""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    def validate(self, data: Dict[str, Any]) -> ValidationResult:
        """
        Validate a submission and return result.
        
        Args:
            data: Raw submission data
            
        Returns:
            ValidationResult with status, errors, warnings, and sanitized data
        """
        self.errors = []
        self.warnings = []
        
        # Step 1: Pydantic validation
        try:
            submission = KingdomSubmission(**data)
        except ValidationError as e:
            for error in e.errors():
                field = ".".join(str(loc) for loc in error["loc"])
                self.errors.append(f"{field}: {error['msg']}")
            return ValidationResult(valid=False, errors=self.errors, warnings=self.warnings)
        
        # Step 2: Business logic validation
        self._validate_business_rules(submission)
        
        # Step 3: Cross-field validation
        self._validate_cross_fields(submission)
        
        # Step 4: Duplicate detection (warning only)
        self._check_duplicates(submission)
        
        # Prepare sanitized data
        sanitized = submission.dict(exclude_none=True)
        sanitized["validated_at"] = datetime.utcnow().isoformat()
        
        return ValidationResult(
            valid=len(self.errors) == 0,
            errors=self.errors,
            warnings=self.warnings,
            sanitized_data=sanitized if len(self.errors) == 0 else None
        )
    
    def _validate_business_rules(self, submission: KingdomSubmission):
        """Apply business-specific validation rules."""
        
        # Rule: Total KvKs should be reasonable
        total_kvks = 0
        if submission.prep_wins is not None:
            total_kvks = max(total_kvks, submission.prep_wins + (submission.prep_losses or 0))
        if submission.battle_wins is not None:
            total_kvks = max(total_kvks, submission.battle_wins + (submission.battle_losses or 0))
        
        if total_kvks > 20:
            self.warnings.append(f"Unusually high KvK count ({total_kvks}) - please verify")
        
        # Rule: Win rates should be somewhat realistic
        for phase in ["prep", "battle"]:
            wins = getattr(submission, f"{phase}_wins")
            losses = getattr(submission, f"{phase}_losses")
            if wins is not None and losses is not None:
                total = wins + losses
                if total > 0:
                    win_rate = wins / total
                    if win_rate == 1.0 and total > 5:
                        self.warnings.append(f"Perfect {phase} record ({wins}-0) - please verify")
                    if win_rate == 0.0 and total > 5:
                        self.warnings.append(f"Zero {phase} wins (0-{losses}) - please verify")
    
    def _validate_cross_fields(self, submission: KingdomSubmission):
        """Validate relationships between fields."""
        
        # Prep and battle totals should be similar
        prep_total = (submission.prep_wins or 0) + (submission.prep_losses or 0)
        battle_total = (submission.battle_wins or 0) + (submission.battle_losses or 0)
        
        if prep_total > 0 and battle_total > 0:
            if abs(prep_total - battle_total) > 2:
                self.warnings.append(
                    f"Prep ({prep_total}) and battle ({battle_total}) totals differ significantly"
                )
    
    def _check_duplicates(self, submission: KingdomSubmission):
        """Check for potential duplicate submissions."""
        # This would check against recent submissions in production
        # For now, just a placeholder
        pass


def validate_json_file(file_path: str) -> ValidationResult:
    """Validate a JSON file containing submission data."""
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return ValidationResult(valid=False, errors=[f"Invalid JSON: {e}"])
    except FileNotFoundError:
        return ValidationResult(valid=False, errors=[f"File not found: {file_path}"])
    
    validator = SubmissionValidator()
    return validator.validate(data)


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python validate_submission.py <submission.json>")
        print("\nOr use --test for a sample validation")
        sys.exit(1)
    
    if sys.argv[1] == "--test":
        # Test with sample data
        sample_data = {
            "kingdom_number": 100,
            "prep_wins": 5,
            "prep_losses": 3,
            "battle_wins": 4,
            "battle_losses": 4,
            "most_recent_status": "Active",
            "source": "user_submission",
            "notes": "Updated after KvK #10"
        }
        print("Testing with sample data:")
        print(json.dumps(sample_data, indent=2))
        print()
        
        validator = SubmissionValidator()
        result = validator.validate(sample_data)
    else:
        result = validate_json_file(sys.argv[1])
    
    # Print results
    print("=" * 50)
    print("  SUBMISSION VALIDATION RESULT")
    print("=" * 50)
    
    if result.valid:
        print("✅ VALID - Submission passed all checks")
    else:
        print("❌ INVALID - Submission failed validation")
    
    if result.errors:
        print(f"\n🚫 Errors ({len(result.errors)}):")
        for error in result.errors:
            print(f"   • {error}")
    
    if result.warnings:
        print(f"\n⚠️  Warnings ({len(result.warnings)}):")
        for warning in result.warnings:
            print(f"   • {warning}")
    
    if result.sanitized_data:
        print(f"\n📦 Sanitized data:")
        print(json.dumps(result.sanitized_data, indent=2))
    
    sys.exit(0 if result.valid else 1)


if __name__ == "__main__":
    main()
