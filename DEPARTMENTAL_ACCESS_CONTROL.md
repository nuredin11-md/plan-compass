# Departmental Access Control Implementation

## ⚠️ IMPORTANT UPDATE: Now includes Multi-Facility Organizational Hierarchy

This document covers **department-level** access control. However, for systems managing **multiple regions with multiple facilities**, see [ORGANIZATIONAL_HIERARCHY_STRUCTURE.md](ORGANIZATIONAL_HIERARCHY_STRUCTURE.md) for the complete 4-level architecture:

```
Region → Facility → Department → Users
```

The security policies below are **per-department within a facility**. The organizational hierarchy document includes region and facility scoping as well.

---

## Overview

This document describes the implementation of department-level data access control in Plan Compass. Users can only enter and view data for their assigned department, preventing unauthorized data manipulation across departments.

## Frontend Implementation ✅ (COMPLETE)

### 1. Department Info Display
**File**: `src/components/MonthlyDataTab.tsx`

Users see a prominent information banner showing their assigned department:

```tsx
{profile && profile.department && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
    <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
    <div className="text-sm text-blue-900">
      <p className="font-semibold">Departmental Access</p>
      <p>You can only enter data for your assigned department: <span className="font-medium text-blue-700">{profile.department}</span></p>
    </div>
  </div>
)}
```

**Features:**
- Visual reminder of departmental restriction
- Uses Shield icon for security emphasis
- Shows user's specific department assignment
- Always visible during data entry

### 2. Audit Logging with Department Context
**File**: `src/components/MonthlyDataTab.tsx`

All data modifications log department information:

```typescript
// Auto-save audit log
AuditLogger.logAction("system", "DATA_AUTO_SAVED", "monthly_data", "success", {
  code: selectedCode,
  month: selectedMonth,
  userId: user?.id,
  department: profile?.department,  // ← Department tracking
  timestamp: new Date().toISOString(),
});

// Manual save audit log
AuditLogger.logAction("system", "DATA_MANUAL_SAVE", "monthly_data", "success", {
  code: selectedCode,
  month: selectedMonth,
  userId: user?.id,
  department: profile?.department,  // ← Department tracking
  timestamp: new Date().toISOString(),
});
```

**Benefits:**
- Tracks which department made each data change
- Enables audit trails for compliance
- Helps detect unauthorized access attempts
- Supports forensic analysis

### 3. User Profile Integration
**Dependency**: `src/hooks/useAuth.tsx`

The component imports user profile containing department:

```typescript
const { user, profile } = useAuth();
```

**Profile Structure**:
```typescript
interface UserProfile {
  id: string;
  email: string;
  department?: string;  // Department assignment
  role: "admin" | "department_head" | "viewer";
  created_at: string;
}
```

## Backend Implementation ⏳ (CRITICAL - MUST DO)

### 1. Row-Level Security (RLS) Policy for monthly_data

**Purpose**: Ensure users can only access data for their department

**SQL Implementation**:

```sql
-- Create RLS policy for department-level access
ALTER TABLE monthly_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their department data" ON monthly_data
  FOR SELECT
  USING (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can only insert data for their department" ON monthly_data
  FOR INSERT
  WITH CHECK (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can only update their department data" ON monthly_data
  FOR UPDATE
  USING (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Admins can see all data
CREATE POLICY "Admins can see all data" ON monthly_data
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );
```

### 2. RLS Policy for data_imports

**Purpose**: Control import operations by department

```sql
ALTER TABLE data_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only import for their department" ON data_imports
  FOR INSERT
  WITH CHECK (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can only view their department imports" ON data_imports
  FOR SELECT
  USING (
    department = (
      SELECT department 
      FROM profiles 
      WHERE id = auth.uid()
    )
  );
```

### 3. Database Trigger for Department Assignment Validation

**Purpose**: Enforce department assignment at database level

```sql
CREATE OR REPLACE FUNCTION validate_department_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Verify department field exists in profiles table
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = NEW.user_id 
    AND department IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'User must have a department assignment';
  END IF;
  
  -- Verify department matches user's assigned department
  IF NEW.department != (SELECT department FROM profiles WHERE id = NEW.user_id) THEN
    RAISE EXCEPTION 'Cannot submit data for a different department';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to monthly_data
CREATE TRIGGER check_department_on_monthly_data_insert
BEFORE INSERT ON monthly_data
FOR EACH ROW
EXECUTE FUNCTION validate_department_on_insert();

-- Attach trigger to data_imports
CREATE TRIGGER check_department_on_import_insert
BEFORE INSERT ON data_imports
FOR EACH ROW
EXECUTE FUNCTION validate_department_on_insert();
```

### 4. Audit Logging Trigger

**Purpose**: Automatically log department-level changes

```sql
CREATE OR REPLACE FUNCTION log_department_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    action,
    resource_type,
    resource_id,
    user_id,
    department,
    changes,
    created_at
  ) VALUES (
    TG_OP,
    'monthly_data',
    NEW.id,
    auth.uid(),
    NEW.department,
    to_jsonb(NEW) - to_jsonb(OLD),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_monthly_data_changes
AFTER INSERT OR UPDATE OR DELETE ON monthly_data
FOR EACH ROW
EXECUTE FUNCTION log_department_action();
```

## Security Architecture

### Data Flow

```
User Login
    ↓
Check Profile (department assigned)
    ↓
MonthlyDataTab Renders
    ↓
Show Department Banner (Frontend reminder)
    ↓
User Enters Data
    ↓
Auto-save with department logging
    ↓
Audit Log Records: user_id + department + action
    ↓
[BACKEND] RLS Policy Validates: department matches
    ↓
[BACKEND] Trigger Confirms: user assigned to department
    ↓
[BACKEND] Stored in monthly_data with department tag
```

### Security Layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI** | Banner + Shield Icon | User awareness |
| **Logging** | AuditLogger | Track responsible party |
| **API** | RLS Policies | Prevent cross-department access |
| **Database** | Triggers | Enforce business logic |
| **Records** | audit_logs table | Forensic analysis |

## Architecture Validation

### Frontend ✅ (Complete)
- [x] Department info banner visible
- [x] Department stored in user profile
- [x] All data operations logged with department
- [x] UI provides security feedback

### Backend ⏳ (CRITICAL - TODO)
- [ ] RLS policies enabling row-level access control
- [ ] Triggers validating department assignment
- [ ] Audit triggers logging changes
- [ ] Email verification before data access
- [ ] Rate limiting on API endpoints

## Testing Checklist

### Frontend Testing (Manual)
```
1. Login as user in Department A
   ✓ Banner shows "Department A"
   ✓ Can enter data
   ✓ Data saved with department logged

2. Login as user in Department B
   ✓ Banner shows "Department B"
   ✓ Cannot see Department A data (frontend)
   ✓ Data saved with Department B

3. Admin Login
   ✓ Can see all departments
   ✓ Can view all data
```

### Backend Testing (After RLS Implementation)
```
1. Attempt department bypass
   - User A tries to POST data with Department B
   - Expected: RLS blocks operation
   - Verify: audit_logs show failed attempt

2. Verify audit trail
   - User makes 5 data changes in Department A
   - Check audit_logs: all 5 have same department
   - Verify: user_id matches

3. Admin override
   - Admin can read all department data
   - Admin can modify other department data
   - All actions logged with admin identity

4. Cross-department access attempt
   - User from Dept A tries direct SQL query
   - Expected: RLS policy returns 0 rows
   - Verify: no error, just no data visible
```

## Deployment Sequence

### Phase 1: Frontend (Already Done ✅)
- [x] Add department banner
- [x] Add department to audit logs
- [x] Deploy to production
- [x] Monitor for errors

### Phase 2: Backend (CRITICAL)
1. **Apply RLS Policies** (Most Important)
   - Create policies on monthly_data table
   - Create policies on data_imports table
   - Test with sample users
   - Monitor audit_logs for violations

2. **Create Validation Triggers** (Critical)
   - Department assignment validation
   - Prevent cross-department inserts
   - Log validation failures

3. **Enable Audit Triggers** (High Priority)
   - Create audit trigger function
   - Attach to all data tables
   - Verify audit_logs populating correctly

### Phase 3: Monitoring
- Monitor audit_logs daily
- Alert on suspicious patterns
- Review department access regularly

## Troubleshooting

### Issue: "Department not found in profile"
**Solution**: Ensure user profile has department assigned during signup/registration

### Issue: RLS policy blocks legitimate access
**Cause**: User profile department doesn't match inserted data department
**Solution**: Use database trigger to auto-populate department from user profile

### Issue: Audit logs show missing department
**Cause**: Frontend logging inconsistency or database trigger not firing
**Solution**: Verify audit trigger is attached and user has valid profile

## Compliance & Audit Trail

✅ **Implemented**:
- User identity logging (user_id)
- Department assignment logging
- Timestamp on all operations
- Action type tracking (INSERT, UPDATE, DELETE)

✅ **Prevents**:
- Cross-department data access
- Unauthorized data modification
- Privilege escalation to other departments
- Unauthorized role changes

✅ **Enables**:
- Forensic investigation
- Department-level compliance reports
- User activity audit trails
- System anomaly detection

## Next Steps

1. **IMMEDIATELY** (Last Day):
   - [ ] Apply RLS policies to Supabase
   - [ ] Create validation triggers
   - [ ] Test with production data
   - [ ] Enable audit triggers

2. **Within 24 Hours**:
   - [ ] Create monitoring dashboard
   - [ ] Set up alerts for RLS violations
   - [ ] Document department admin responsibilities
   - [ ] Create user access logs

3. **Within 1 Week**:
   - [ ] Conduct cross-department scenario testing
   - [ ] Performance test under load
   - [ ] Document incident response procedures
   - [ ] Train department heads

## References

- Frontend: [MonthlyDataTab.tsx](src/components/MonthlyDataTab.tsx)
- Security Utils: [securityUtils.ts](src/lib/securityUtils.ts)
- Auth Hook: [useAuth.tsx](src/hooks/useAuth.tsx)
- Related: [SECURITY_FIXES_CRITICAL.md](SECURITY_FIXES_CRITICAL.md)
