# Departmental Access Control - Supabase Implementation Guide

## CRITICAL: Do This Before Production Launch

This guide provides step-by-step SQL commands to implement department-level Row-Level Security (RLS) in Supabase.

## Prerequisites

1. Access to Supabase dashboard: https://supabase.com/dashboard
2. Your project's SQL editor
3. Backup of current data (recommended)

## Step 1: Verify Profile Table Structure

Run this query to confirm your profiles table has the department column:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

**Expected output should include**:
- `id` (uuid)
- `email` (text)
- `department` (text or varchar)
- `role` (text or enum)

If department is missing, add it:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department VARCHAR(255);
```

## Step 2: Create monthly_data RLS Policies

### 2.1 Enable RLS on monthly_data Table

```sql
-- Enable Row Level Security
ALTER TABLE monthly_data ENABLE ROW LEVEL SECURITY;

-- Optional: Drop existing policies if reapplying
DROP POLICY IF EXISTS "Users can only access their department data" ON monthly_data;
DROP POLICY IF EXISTS "Users can only insert data for their department" ON monthly_data;
DROP POLICY IF EXISTS "Users can only update their department data" ON monthly_data;
DROP POLICY IF EXISTS "Admins can see all data" ON monthly_data;
```

### 2.2 Policy 1: SELECT - Users See Only Their Department

```sql
CREATE POLICY "Users can only access their department data" ON monthly_data
  FOR SELECT
  USING (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
    OR
    -- Allow admins to see everything
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  );
```

### 2.3 Policy 2: INSERT - Users Can Only Insert for Their Department

```sql
CREATE POLICY "Users can only insert data for their department" ON monthly_data
  FOR INSERT
  WITH CHECK (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
    OR
    -- Allow admins to insert for any department
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  );
```

### 2.4 Policy 3: UPDATE - Users Can Only Update Their Department Data

```sql
CREATE POLICY "Users can only update their department data" ON monthly_data
  FOR UPDATE
  USING (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  )
  WITH CHECK (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  );
```

### 2.5 Policy 4: DELETE - Prevent User Deletion (Admins Only)

```sql
CREATE POLICY "Admins can delete data" ON monthly_data
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  );
```

## Step 3: Create data_imports RLS Policies

### 3.1 Enable RLS on data_imports Table

```sql
ALTER TABLE data_imports ENABLE ROW LEVEL SECURITY;

-- Optional: Drop existing policies if reapplying
DROP POLICY IF EXISTS "Users can only import for their department" ON data_imports;
DROP POLICY IF EXISTS "Users can only view their department imports" ON data_imports;
```

### 3.2 Policy 1: Users Can Only Import for Their Department

```sql
CREATE POLICY "Users can only import for their department" ON data_imports
  FOR INSERT
  WITH CHECK (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  );
```

### 3.3 Policy 2: Users Can Only View Their Department's Imports

```sql
CREATE POLICY "Users can only view their department imports" ON data_imports
  FOR SELECT
  USING (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  );
```

## Step 4: Create Validation Trigger

This ensures data always has the correct department assigned:

```sql
-- Create the validation function
CREATE OR REPLACE FUNCTION validate_department_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Get user's department
  DECLARE
    user_department VARCHAR(255);
  BEGIN
    SELECT department INTO user_department
    FROM profiles
    WHERE id = auth.uid();
    
    -- If no department found, raise error
    IF user_department IS NULL THEN
      RAISE EXCEPTION 'User must have a valid department assignment';
    END IF;
    
    -- Set new row's department to user's department
    NEW.department := user_department;
    
    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS enforce_department_on_monthly_data ON monthly_data;

-- Create trigger for monthly_data
CREATE TRIGGER enforce_department_on_monthly_data
BEFORE INSERT ON monthly_data
FOR EACH ROW
EXECUTE FUNCTION validate_department_assignment();

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS enforce_department_on_data_imports ON data_imports;

-- Create trigger for data_imports
CREATE TRIGGER enforce_department_on_data_imports
BEFORE INSERT ON data_imports
FOR EACH ROW
EXECUTE FUNCTION validate_department_assignment();
```

## Step 5: Create Audit Logging (Optional but Recommended)

### 5.1 Create audit_logs Table (if not exists)

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  user_id UUID REFERENCES auth.users(id),
  department VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_department ON audit_logs(department);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

### 5.2 Create Audit Trigger Function

```sql
CREATE OR REPLACE FUNCTION log_data_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      action, resource_type, resource_id, user_id, department, 
      old_values, status, created_at
    ) VALUES (
      'DELETE',
      TG_TABLE_NAME,
      OLD.id,
      auth.uid(),
      OLD.department,
      to_jsonb(OLD),
      'success',
      NOW()
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      action, resource_type, resource_id, user_id, department,
      old_values, new_values, status, created_at
    ) VALUES (
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id,
      auth.uid(),
      NEW.department,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      action, resource_type, resource_id, user_id, department,
      new_values, status, created_at
    ) VALUES (
      'INSERT',
      TG_TABLE_NAME,
      NEW.id,
      auth.uid(),
      NEW.department,
      to_jsonb(NEW),
      'success',
      NOW()
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing audit triggers
DROP TRIGGER IF EXISTS audit_monthly_data_changes ON monthly_data;
DROP TRIGGER IF EXISTS audit_data_imports_changes ON data_imports;

-- Create audit triggers
CREATE TRIGGER audit_monthly_data_changes
AFTER INSERT OR UPDATE OR DELETE ON monthly_data
FOR EACH ROW
EXECUTE FUNCTION log_data_changes();

CREATE TRIGGER audit_data_imports_changes
AFTER INSERT OR UPDATE OR DELETE ON data_imports
FOR EACH ROW
EXECUTE FUNCTION log_data_changes();
```

## Step 6: Testing & Validation

### 6.1 Test SELECT Access (User Only Sees Own Department)

```sql
-- Get a test user's ID
SELECT id, email, department 
FROM profiles 
WHERE email = 'test@example.com'
LIMIT 1;

-- Switch to that user's context in Supabase (using appropriate method)
-- Then query: Should only see data for their department
SELECT * FROM monthly_data;
```

### 6.2 Test INSERT Access (Can Only Insert for Own Department)

```sql
-- Attempt to insert as Department A user (should succeed if correct department)
INSERT INTO monthly_data (code, month, actual, department)
VALUES ('INDICATOR_001', '1', 100, 'Department A')
RETURNING *;
```

### 6.3 Verify RLS Blocks Cross-Department Access

```sql
-- Query audit_logs to see attempted violations
SELECT * FROM audit_logs 
WHERE status = 'error'
ORDER BY created_at DESC
LIMIT 10;
```

## Step 7: Verify Policies Are Active

Run this query to confirm all policies are enabled:

```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  (
    SELECT COUNT(*) 
    FROM information_schema.role_table_grants 
    WHERE table_schema = t.schemaname 
    AND table_name = t.tablename
  ) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename IN ('monthly_data', 'data_imports', 'profiles')
ORDER BY tablename;
```

## Step 8: Monitoring & Debugging

### View Active Policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('monthly_data', 'data_imports')
ORDER BY tablename, policyname;
```

### View Recent Audit Logs

```sql
-- Check recent changes
SELECT 
  action,
  resource_type,
  (SELECT email FROM profiles WHERE id = user_id) as user_email,
  department,
  status,
  created_at
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Count changes by department
SELECT 
  department,
  action,
  COUNT(*) as count
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY department, action
ORDER BY count DESC;
```

### Identify Issues

```sql
-- Find all failed operations
SELECT 
  user_id,
  department,
  action,
  error_message,
  created_at
FROM audit_logs
WHERE status = 'error'
ORDER BY created_at DESC;

-- Find operations by specific user
SELECT 
  action,
  resource_type,
  department,
  created_at
FROM audit_logs
WHERE user_id = '00000000-0000-0000-0000-000000000000'  -- Replace with actual user ID
ORDER BY created_at DESC;
```

## Troubleshooting Common Issues

### Issue: "permission denied" or "Rows do not exist or you do not have permission"

**Cause**: User's profile doesn't have department assigned
**Solution**: 
```sql
UPDATE profiles 
SET department = 'Department A' 
WHERE email = 'user@example.com';
```

### Issue: All data is inaccessible after enabling RLS

**Cause**: RLS policies too restrictive or profile data missing
**Solution**:
```sql
-- Verify user has valid profile with department
SELECT * FROM profiles WHERE id = auth.uid();

-- If missing, RLS will block all access
-- Temporarily disable RLS to debug
ALTER TABLE monthly_data DISABLE ROW LEVEL SECURITY;
-- Fix profile data
-- Re-enable RLS
ALTER TABLE monthly_data ENABLE ROW LEVEL SECURITY;
```

### Issue: Admin users can't see other department data

**Cause**: Admin check in policy not working
**Solution**: Verify admin role is exactly 'admin' in profiles:
```sql
SELECT id, email, role, department FROM profiles WHERE role = 'admin';
```

## Rollback Procedures

If you need to revert changes:

```sql
-- Disable RLS temporarily
ALTER TABLE monthly_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_imports DISABLE ROW LEVEL SECURITY;

-- Remove triggers
DROP TRIGGER IF EXISTS enforce_department_on_monthly_data ON monthly_data;
DROP TRIGGER IF EXISTS enforce_department_on_data_imports ON data_imports;
DROP TRIGGER IF EXISTS audit_monthly_data_changes ON monthly_data;
DROP TRIGGER IF EXISTS audit_data_imports_changes ON data_imports;

-- Remove functions
DROP FUNCTION IF EXISTS validate_department_assignment();
DROP FUNCTION IF EXISTS log_data_changes();

-- Remove policies
DROP POLICY IF EXISTS "Users can only access their department data" ON monthly_data;
DROP POLICY IF EXISTS "Users can only insert data for their department" ON monthly_data;
DROP POLICY IF EXISTS "Users can only update their department data" ON monthly_data;
DROP POLICY IF EXISTS "Admins can delete data" ON monthly_data;
DROP POLICY IF EXISTS "Users can only import for their department" ON data_imports;
DROP POLICY IF EXISTS "Users can only view their department imports" ON data_imports;
```

## Performance Optimization

For large datasets, create indexes:

```sql
-- If not already created
CREATE INDEX IF NOT EXISTS idx_monthly_data_department 
ON monthly_data(department);

CREATE INDEX IF NOT EXISTS idx_monthly_data_user_department 
ON monthly_data(department, code, month);

CREATE INDEX IF NOT EXISTS idx_data_imports_department 
ON data_imports(department);

CREATE INDEX IF NOT EXISTS idx_profiles_department 
ON profiles(department);
```

## Checklist for Deployment

- [ ] Backup production database
- [ ] Run Step 2 (monthly_data RLS policies)
- [ ] Run Step 3 (data_imports RLS policies)  
- [ ] Run Step 4 (Validation trigger)
- [ ] Run Step 5 (Audit logging) - optional but recommended
- [ ] Run Step 6 (Testing) - verify with test users
- [ ] Verify policies with Step 7
- [ ] Monitor with Step 8 queries
- [ ] Brief team on changes
- [ ] Enable monitoring/alerts

## Production Deployment

**Recommended timing**: Off-peak hours
**Downtime**: None (RLS can be enabled without downtime)
**Rollback time**: < 5 minutes if needed

## Support & Escalation

If you encounter issues:

1. Check audit_logs for error details
2. Verify all users have department assigned
3. Confirm role values match exactly ('admin', 'department_head', 'viewer')
4. Contact Supabase support if policy isn't working

## Next Steps

After deploying backend RLS:

1. ✅ Frontend already shows department banner
2. ✅ Frontend already logs department in audit
3. ✅ Test with multiple users across departments
4. ✅ Monitor audit logs for violations
5. ✅ Set up alerts for suspicious patterns
6. ✅ Document incident response procedures

---

**Last Updated**: 2024
**Version**: 1.0
**Status**: Ready for Production Deployment
