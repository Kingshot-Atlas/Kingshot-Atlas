#!/usr/bin/env python3
"""
Security testing automation script for Kingshot Atlas
Implements automated security scans and checks
"""
import subprocess
import json
import sys
import os
from pathlib import Path

def run_command(cmd, cwd=None, check=True):
    """Run a command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd, check=check)
        return result.stdout, result.stderr, result.returncode
    except subprocess.CalledProcessError as e:
        return e.stdout, e.stderr, e.returncode

def check_npm_vulnerabilities():
    """Check for npm vulnerabilities"""
    print("🔍 Checking npm vulnerabilities...")
    web_path = Path(__file__).parent / "apps" / "web"
    
    stdout, stderr, code = run_command("npm audit --json", cwd=str(web_path), check=False)
    
    if code == 0:
        print("✅ No npm vulnerabilities found")
        return {"status": "pass", "vulnerabilities": 0}
    else:
        try:
            audit_data = json.loads(stdout)
            vuln_count = len(audit_data.get("vulnerabilities", {}))
            print(f"⚠️ Found {vuln_count} npm vulnerabilities")
            return {"status": "fail", "vulnerabilities": vuln_count, "data": audit_data}
        except json.JSONDecodeError:
            print("❌ Failed to parse npm audit output")
            return {"status": "error", "message": stderr}

def check_python_vulnerabilities():
    """Check for Python vulnerabilities"""
    print("🔍 Checking Python vulnerabilities...")
    api_path = Path(__file__).parent / "apps" / "api"
    
    # Try pip-audit first, fallback to safety
    stdout, stderr, code = run_command("pip-audit --format=json", cwd=str(api_path), check=False)
    
    if code == 0:
        print("✅ No Python vulnerabilities found")
        return {"status": "pass", "vulnerabilities": 0}
    else:
        # Try safety as fallback
        stdout, stderr, code = run_command("safety check --json", cwd=str(api_path), check=False)
        if code == 0:
            print("✅ No Python vulnerabilities found")
            return {"status": "pass", "vulnerabilities": 0}
        else:
            print("⚠️ Python vulnerability scanning failed or found issues")
            return {"status": "fail", "message": stderr}

def check_security_headers():
    """Check security headers on production site"""
    print("🔍 Checking security headers...")
    
    stdout, stderr, code = run_command(
        "curl -I -s https://ks-atlas.com",
        check=False
    )
    
    if code == 0:
        headers = stdout
        required_headers = [
            "x-content-type-options",
            "x-frame-options", 
            "strict-transport-security",
            "content-security-policy",
            "referrer-policy"
        ]
        
        missing_headers = []
        for header in required_headers:
            if header not in headers.lower():
                missing_headers.append(header)
        
        if missing_headers:
            print(f"⚠️ Missing security headers: {', '.join(missing_headers)}")
            return {"status": "fail", "missing_headers": missing_headers}
        else:
            print("✅ All required security headers present")
            return {"status": "pass"}
    else:
        print("❌ Failed to check security headers")
        return {"status": "error", "message": stderr}

def check_cors_configuration():
    """Check CORS configuration"""
    print("🔍 Checking CORS configuration...")
    
    stdout, stderr, code = run_command(
        'curl -H "Origin: https://evil.com" -I -s https://ks-atlas.com/api/v1/kingdoms',
        check=False
    )
    
    if code == 0:
        if "access-control-allow-origin: https://evil.com" in stdout.lower():
            print("❌ CORS allows unauthorized origins")
            return {"status": "fail", "issue": "Overly permissive CORS"}
        else:
            print("✅ CORS properly configured")
            return {"status": "pass"}
    else:
        print("⚠️ Could not test CORS configuration")
        return {"status": "error", "message": stderr}

def run_static_analysis():
    """Run static code analysis for security issues"""
    print("🔍 Running static code analysis...")
    
    api_path = Path(__file__).parent / "apps" / "api"
    web_path = Path(__file__).parent / "apps" / "web"
    
    # Check for common security issues in Python code (exclude venv)
    security_issues = []
    
    # Check for hardcoded secrets (exclude venv and node_modules)
    python_files = [f for f in api_path.rglob("*.py") if "venv" not in str(f)]
    for file_path in python_files:
        try:
            content = file_path.read_text()
            lines = content.split('\n')
            for i, line in enumerate(lines, 1):
                # More specific checks for actual hardcoded secrets
                suspicious_patterns = [
                    'password =', 'secret =', 'key =', 'token =',
                    'password:"', 'secret:"', 'key:"', 'token:"',
                    'password\'', 'secret\'', 'key\'', 'token\''
                ]
                line_lower = line.lower()
                if any(pattern in line_lower for pattern in suspicious_patterns):
                    # Only flag if not using environment variables and not a comment
                    if ('os.getenv' not in line and 'environment' not in line_lower and 
                        not line.strip().startswith('#') and 
                        'import' not in line and 'from' not in line):
                        security_issues.append(f"Line {i} in {file_path.relative_to(Path(__file__).parent)}: {line.strip()[:100]}")
        except Exception as e:
            print(f"Warning: Could not read {file_path}: {e}")
    
    # Check for eval() usage in JavaScript (exclude node_modules)
    js_files = []
    for pattern in ["*.js", "*.tsx", "*.ts"]:
        js_files.extend(web_path.glob(pattern))
        js_files.extend(web_path.rglob(pattern))
    
    # Filter out node_modules
    js_files = [f for f in js_files if "node_modules" not in str(f)]
    
    for file_path in js_files:
        try:
            content = file_path.read_text()
            lines = content.split('\n')
            for i, line in enumerate(lines, 1):
                if 'eval(' in line and 'dangerouslySetInnerHTML' not in line and not line.strip().startswith('//'):
                    security_issues.append(f"Line {i} in {file_path.relative_to(Path(__file__).parent)}: {line.strip()[:100]}")
        except Exception as e:
            print(f"Warning: Could not read {file_path}: {e}")
    
    # Limit output to first 10 issues to avoid spam
    if security_issues:
        display_issues = security_issues[:10]
        if len(security_issues) > 10:
            print(f"⚠️ Found {len(security_issues)} potential security issues (showing first 10):")
        else:
            print(f"⚠️ Found {len(security_issues)} potential security issues:")
        
        for issue in display_issues:
            print(f"  - {issue}")
        
        return {"status": "fail", "issues": security_issues}
    else:
        print("✅ No obvious security issues found")
        return {"status": "pass"}

def generate_security_report(results):
    """Generate a security report"""
    report = {
        "timestamp": "2026-01-29T17:35:00Z",
        "overall_status": "pass" if all(r["status"] == "pass" for r in results.values()) else "fail",
        "checks": results
    }
    
    report_path = Path(__file__).parent / "security_report.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Security report saved to {report_path}")
    
    # Summary
    passed = sum(1 for r in results.values() if r["status"] == "pass")
    total = len(results)
    print(f"\n📊 Security Summary: {passed}/{total} checks passed")
    
    return report

def main():
    """Main security testing function"""
    print("🔒 Kingshot Atlas Security Testing")
    print("=" * 40)
    
    results = {}
    
    # Run all security checks
    results["npm_vulnerabilities"] = check_npm_vulnerabilities()
    results["python_vulnerabilities"] = check_python_vulnerabilities()
    results["security_headers"] = check_security_headers()
    results["cors_configuration"] = check_cors_configuration()
    results["static_analysis"] = run_static_analysis()
    
    # Generate report
    report = generate_security_report(results)
    
    # Exit with error code if any checks failed
    if report["overall_status"] == "fail":
        print("\n❌ Security testing failed - see report for details")
        sys.exit(1)
    else:
        print("\n✅ All security checks passed")
        sys.exit(0)

if __name__ == "__main__":
    main()
