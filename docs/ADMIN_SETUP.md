# Admin User Setup Guide

This guide explains how to set up admin and moderator users for Kingshot Atlas.

---

## Quick Setup for gatreno (Discord)

After you log in with your Discord account (`gatreno`), run this SQL in Supabase:

```sql
-- Make gatreno an admin (run after first login)
UPDATE profiles 
SET role = 'admin' 
WHERE username ILIKE '%gatreno%' 
   OR username ILIKE 'gatreno%';

-- Alternative: If you know your Supabase user ID
-- UPDATE profiles SET role = 'admin' WHERE id = 'your-supabase-user-id';
```

---

## How It Works

1. **User logs in** via Discord/Google/Email
2. **Profile is created** in the `profiles` table automatically
3. **Run SQL** to upgrade their role to `admin` or `moderator`
4. **Role is checked** on protected endpoints (submission review, claim verification)

---

## User Roles

| Role | Permissions |
|------|-------------|
| `user` | Submit data, claim kingdoms, view everything |
| `moderator` | All user permissions + review/approve submissions |
| `admin` | All permissions + verify kingdom claims |

---

## SQL Commands

### Make someone an admin
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'user@email.com';
```

### Make someone a moderator
```sql
UPDATE profiles SET role = 'moderator' WHERE email = 'user@email.com';
```

### List all admins
```sql
SELECT username, email, role FROM profiles WHERE role = 'admin';
```

### List all moderators
```sql
SELECT username, email, role FROM profiles WHERE role IN ('admin', 'moderator');
```

---

## Required Database Schema

If the `role` column doesn't exist, add it:

```sql
-- Add role column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
```

---

## First-Time Setup Checklist

1. [ ] Deploy backend to Render
2. [ ] Deploy frontend to Cloudflare Pages
3. [ ] Connect Supabase database
4. [ ] Log in with your Discord account (gatreno)
5. [ ] Run the SQL above to make yourself admin
6. [ ] Verify by checking submission review endpoints work

---

*Created: January 27, 2026*
