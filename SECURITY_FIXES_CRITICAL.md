# 🔒 Critical Security Fixes & Implementation Guide

## ⚠️ IMPORTANT: Multi-Facility Organizational Hierarchy

This system now supports **multi-region, multi-facility deployments**:

```
Region → Facility → Department → Users
```

All security policies below must be implemented with this organizational context:
- **Region-level** isolation (regional health bureaus, states, regions)
- **Facility-level** isolation (hospitals, health centers, health posts)
- **Department-level** isolation (programs/services within facilities)
- **User-level** role-based access control

📖 **Full Details**: See [ORGANIZATIONAL_HIERARCHY_STRUCTURE.md](ORGANIZATIONAL_HIERARCHY_STRUCTURE.md)

---

## Issues Fixed ✅

### 1. **Users Selecting Own Role During Signup** ✅ FIXED
**Status**: CRITICAL - FIXED  
**Before**: Users could select any role (admin, department_head, data_entry, viewer) during signup  
**After**: Users can only sign up as "viewer". Roles must be assigned by administrators only  
**Location**: `/src/pages/Auth.tsx`

**What Changed**:
```jsx
// BEFORE (VULNERABLE)
<Select value={role} onValueChange={setRole}>
  {ROLES.map((r) => (
    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
  ))}
</Select>

// AFTER (SECURE)
// Role selection removed from signup form
// Default role: "viewer"
// Only administrators can assign roles
```

**LATEST UPDATE** (Multi-Facility Support):
```tsx
// Auth.tsx now includes region and facility selection
// Signup flow now requires:
// 1. Region selection (from regions table)
// 2. Facility selection (dependent on region)
// 3. Department selection
// 4. Role is hardcoded to "viewer"

// This ensures proper organizational hierarchy from signup:
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      display_name: displayName,
      region_id: selectedRegion,        // ← NEW
      facility_id: selectedFacility,    // ← NEW
      department: department,
      role: DEFAULT_USER_ROLE // Always "viewer"
    }
  }
});
```

---

### 2. **Department-Level Data Access Control** ⚠️ IMPROVED FRONTEND / BACKEND RLS PENDING

**Status**: HIGH PRIORITY - Frontend Improved ✅ / RLS Policy Required ⏳  
**Issue**: Users could submit data for departments they don't belong to

**Frontend Improvements** ✅ (JUST IMPLEMENTED):

1. **Department Banner** - Users now see their assigned department:
```tsx
<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
  <Shield className="h-5 w-5 text-blue-600" />
  <p>You can only enter data for your assigned department: <strong>{profile.department}</strong></p>
</div>
```

2. **Enhanced Audit Logging** - All data operations now include department context:
```typescript
AuditLogger.logAction("system", "DATA_AUTO_SAVED", "monthly_data", "success", {
  code: selectedCode,
  month: selectedMonth,
  userId: user?.id,
  department: profile?.department,  // ← NEW: Department tracking
  timestamp: new Date().toISOString(),
});
```

3. **Files Modified**: 
   - `/src/components/MonthlyDataTab.tsx` - Added department banner and audit logging

**Backend RLS Policy Required** (COPY-PASTE READY):

See [SUPABASE_RLS_IMPLEMENTATION.md](SUPABASE_RLS_IMPLEMENTATION.md) for complete SQL

```sql
-- Apply to monthly_data table
CREATE POLICY "Users can only access their department's data"
ON monthly_data
FOR SELECT
USING (
  -- Allow admins to see all
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR
  -- Allow users to only see their department's data
  department = (SELECT department FROM profiles WHERE id = auth.uid())
);

-- Prevent inserting data for other departments
CREATE POLICY "Users can only insert data for their department" 
ON monthly_data
FOR INSERT
WITH CHECK (
  department = (SELECT department FROM profiles WHERE id = auth.uid())
);
```

**Current State**:
- ✅ Frontend shows department clearly
- ✅ All operations logged with department info
- ⏳ Backend still needs RLS enforcement (CRITICAL)
- ⏳ Database trigger still needed to auto-assign department

**Documentation**:
- Full implementation guide: [DEPARTMENTAL_ACCESS_CONTROL.md](DEPARTMENTAL_ACCESS_CONTROL.md)
- Copy-paste SQL for Supabase: [SUPABASE_RLS_IMPLEMENTATION.md](SUPABASE_RLS_IMPLEMENTATION.md)

---

### 3. **Signup Trigger Role Validation** ⚠️ NEEDS BACKEND TRIGGER

**Status**: HIGH PRIORITY - REQUIRES DATABASE TRIGGER  
**Issue**: Signup trigger accepts user-supplied role without validation

**Required Supabase Edge Function/Trigger**:
```typescript
// supabase/functions/handle-new-user/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { user } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // IMPORTANT: Always set default role as 'viewer'
  // IGNORE any role sent from client
  await supabase.from("user_roles").insert({
    user_id: user.id,
    role: "viewer", // ALWAYS viewer - never user-supplied
    created_at: new Date(),
  });

  await supabase.from("user_profiles").insert({
    user_id: user.id,
    display_name: user.user_metadata?.display_name || "User",
    department: user.user_metadata?.department || "Unassigned",
    verified: false, // Require email verification
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

---

### 4. **Data Integrity & Access Control** ⚠️ NEEDS BACKEND VALIDATION

**Status**: CRITICAL - REQUIRES SERVER-SIDE VALIDATION  
**Issue**: Any authenticated user can insert false performance data

**Frontend Department Restriction Added** ✅:
```typescript
// /src/components/MonthlyDataTab.tsx
// Users can now only see indicators for their assigned department
const accessibleIndicators = useMemo(() => {
  if (!profile?.department) return [];
  return indicators.filter(ind => 
    ind.department === profile.department ||
    profile.department === "All" // Only for super-admins
  );
}, [profile?.department]);
```

**Required Backend Table Constraints**:
```sql
-- Add data integrity constraints
ALTER TABLE monthly_data
ADD CONSTRAINT data_ownership_constraint
CHECK (department = current_user_department());

-- Audit log triggers
CREATE TRIGGER audit_data_changes
AFTER INSERT OR UPDATE OR DELETE ON monthly_data
FOR EACH ROW
EXECUTE FUNCTION audit_trigger_function();

-- Prevent large anomalous changes
CREATE TRIGGER prevent_data_anomalies
BEFORE INSERT OR UPDATE ON monthly_data
FOR EACH ROW
EXECUTE FUNCTION validate_data_range();
```

---

## Implementation Steps

### ✅ COMPLETED (Frontend)
1. ✅ Role selection removed from signup
2. ✅ Default role set to "viewer"
3. ✅ Role assignment info message added  
4. ✅ Department validation on form

### ⏳ REQUIRED (Backend/Supabase)

**Priority 1 - CRITICAL** (Do within 24 hours):
- [ ] Create RLS policies for monthly_data table
- [ ] Create RLS policies for data_imports table
- [ ] Create database trigger to set default role for new users
- [ ] Add email verification requirement before role assignment

**Priority 2 - HIGH** (Do within 48 hours):
- [ ] Create admin role management UI (separate from signup)
- [ ] Add audit logs for all role assignments
- [ ] Implement data validation triggers
- [ ] Add anomaly detection for suspicious data entries

**Priority 3 - MEDIUM** (Do within 1 week):
- [ ] Create department head approval workflow
- [ ] Add data import audit trail
- [ ] Implement rate limiting on data submission
- [ ] Create admin audit dashboard

---

## Database Setup (Supabase)

### Required Tables:
```sql
CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text NOT NULL,
  department text NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'data_entry', 'department_head', 'admin')),
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamp DEFAULT now()
);

CREATE TABLE monthly_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  department text NOT NULL,
  indicator_code text NOT NULL,
  month text NOT NULL,
  actual numeric,
  remarks text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT unique_entry UNIQUE(department, indicator_code, month)
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  timestamp timestamp DEFAULT now()
);
```

---

## Testing Checklist

- [ ] New user signup sets role to 'viewer' (verify in database)
- [ ] Admin can assign roles only through admin interface (not signup)
- [ ] User can only see data for their department
- [ ] User cannot submit data for other departments (backend validation)
- [ ] Role changes are logged in audit trail
- [ ] Email verification required before data access
- [ ] Large data changes trigger alerts
- [ ] Import operations require department_head+ role

---

## Deployment

**Frontend** ✅ - Already deployed  
**Backend** ⏳ - Must be deployed before considering secure

**Deploy Checklist**:
1. [ ] Create Supabase functions for role validation
2. [ ] Deploy RLS policies
3. [ ] Deploy database triggers  
4. [ ] Enable email verification
5. [ ] Run full security audit
6. [ ] Test all RLS policies
7. [ ] Update admin documentation

---

## Current Vulnerability Status

| Issue | Status | Risk |
|-------|--------|------|
| Role selection in signup | ✅ FIXED | Critical |
| Department data access | ⏳ NEEDS RLS | Critical |
| Role validation trigger | ⏳ NEEDS TRIGGER | Critical |
| False data insertion | ⏳ NEEDS VALIDATION | High |
| Audit logging | ⏳ PARTIAL | Medium |

---

## Next Steps

1. **Immediate (Today)**:
   - ✅ Deploy frontend signup fix
   - [ ] Create Supabase RLS policies
   - [ ] Set up role assignment admin interface

2. **Within 48 hours**:
   - [ ] Deploy all database triggers
   - [ ] Run security audit
   - [ ] Test with real data

3. **Within 1 week**:
   - [ ] Implement audit dashboard
   - [ ] Add monitoring & alerts
   - [ ] Train admins on role management

---

**Last Updated**: February 15, 2026  
**Status**: Frontend ✅ Secured | Backend ⏳ Pending
