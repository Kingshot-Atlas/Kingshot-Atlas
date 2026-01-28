# Blocker Fix Requirements

**Created:** 2026-01-26  
**Status:** 🔴 BLOCKING RELEASE  
**Estimated Fix Time:** 4-5 hours total

---

## Overview

Two critical security issues must be fixed before any deployment. Both are in the authentication system.

---

## Blocker 1: Fake Password Hashing

### Current Code (INSECURE)
**File:** `apps/api/api/routers/auth.py` lines 14-18

```python
def fake_hash_password(password: str) -> str:
    return "hashed_" + password

def fake_verify_password(plain_password: str, hashed_password: str) -> bool:
    return hashed_password == "hashed_" + plain_password
```

### Problem
Passwords are stored as `"hashed_" + plaintext`. Anyone with database access can read all passwords instantly.

### Fix Required

**Step 1:** Add dependency to `requirements.txt`:
```
passlib[bcrypt]==1.7.4
```

**Step 2:** Replace functions in `auth.py`:
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
```

**Step 3:** Update `register()` and `login_for_access_token()` to use new functions.

**Step 4:** Clear existing test users or re-hash their passwords.

### Estimated Time: 1 hour

---

## Blocker 2: No JWT Token Implementation

### Current Code (INSECURE)
**File:** `apps/api/api/routers/auth.py` lines 67-68

```python
access_token = "placeholder_token_for_" + user.username
```

And token validation (lines 20-29):
```python
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # Token is IGNORED - always queries for "placeholder_user"
    user = db.query(User).filter(User.username == "placeholder_user").first()
```

### Problem
- Tokens are predictable strings, not cryptographically signed
- Token validation doesn't actually validate anything
- Any attacker can forge tokens

### Fix Required

**Step 1:** Add dependency to `requirements.txt`:
```
python-jose[cryptography]==3.3.0
```

**Step 2:** Add configuration constants at top of `auth.py`:
```python
import os
from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable must be set")
    
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
```

**Step 3:** Add token creation function:
```python
def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

**Step 4:** Fix `get_current_user()`:
```python
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user
```

**Step 5:** Fix `login_for_access_token()`:
```python
@router.post("/auth/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}
```

**Step 6:** Set SECRET_KEY in environment:
```bash
# Generate a secure key:
python -c "import secrets; print(secrets.token_hex(32))"

# Set in environment:
export SECRET_KEY="your-generated-key-here"
```

### Estimated Time: 2-3 hours

---

## Testing After Fix

```bash
# 1. Register a new user
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "SecurePass123!"}'

# 2. Login and get token
curl -X POST "http://localhost:8000/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=SecurePass123!"

# Should return a real JWT like:
# {"access_token":"eyJhbGciOiJIUzI1NiIs...","token_type":"bearer"}

# 3. Verify token works
curl "http://localhost:8000/api/auth/me" \
  -H "Authorization: Bearer <token-from-step-2>"

# 4. Verify invalid token fails
curl "http://localhost:8000/api/auth/me" \
  -H "Authorization: Bearer invalid_token"
# Should return 401 Unauthorized
```

---

## Verification Checklist

After implementing fixes:

- [ ] `requirements.txt` has `passlib[bcrypt]` and `python-jose[cryptography]`
- [ ] `SECRET_KEY` is set in environment (not hardcoded)
- [ ] New user registration hashes password with bcrypt
- [ ] Login returns a real JWT token
- [ ] `get_current_user()` validates JWT signature and expiry
- [ ] Invalid tokens return 401 Unauthorized
- [ ] Old test users are deleted or passwords re-hashed

---

## Do NOT Deploy Until

- [ ] Both blockers are fixed
- [ ] All verification tests pass
- [ ] Code review confirms proper implementation
- [ ] No plaintext passwords exist in database

---

*Document maintained by Governance Agent*
