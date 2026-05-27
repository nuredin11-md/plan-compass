# Multi-Level Organizational Hierarchy Implementation

## Organizational Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    NATIONAL LEVEL                           │
│                  (Admin Dashboard)                          │
└────────────────────────────────────────────────────────────┐
                                                              │
     ┌──────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│          REGION 1 (Regional Health Bureau)                  │
│          - Amhara Region / Oromia / SNNPR, etc              │
│          - Regional Coordinators                            │
│          - Can see: All facilities in region                │
└────────────────────────────────────────────────────────────┐
     │
     ├─────────────────────┬───────────────────────┐
     │                     │                       │
     ▼                     ▼                       ▼
┌──────────────┐   ┌──────────────┐      ┌──────────────┐
│ FACILITY 1   │   │ FACILITY 2   │      │ FACILITY N   │
│(Hospital)    │   │(Health Ctr)  │      │(Health Post) │
│              │   │              │      │              │
│Region: Amh   │   │Region: Amh   │      │Region: Amh   │
│Facility: H1  │   │Facility: HC2 │      │Facility: HP3 │
└──────┬───────┘   └──────┬───────┘      └──────┬───────┘
       │                   │                     │
       ├──────────┬────────┴───────┬─────────────┤
       │          │                │             │
       ▼          ▼                ▼             ▼
    ┌──────────────────────────────────────────────┐
    │    DEPARTMENTS (Programs/Services)           │
    │  - Maternal & Child Health                   │
    │  - TB Program                                │
    │  - HIV/AIDS Program                          │
    │  - WASH                                      │
    │  - Nutrition                                 │
    └──────────────────────────────────────────────┘
       │          │                │             │
       ▼          ▼                ▼             ▼
    ┌──────┐  ┌──────┐         ┌──────┐     ┌───────┐
    │User1 │  │User2 │  ...    │UserN │     │Admin  │
    │Viewer│  │Head  │         │Data  │     │       │
    └──────┘  └──────┘         └──────┘     └───────┘
```

## Data Model

### 1. Reference Tables

#### `regions` table
```sql
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,  -- "AMHARA", "OROMIA", "SNNPR"
  name VARCHAR(100) NOT NULL,         -- "Amhara Region", "Oromia Region"
  description TEXT,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'archived'
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

INSERT INTO regions (code, name) VALUES
  ('AMHARA', 'Amhara Region'),
  ('OROMIA', 'Oromia Region'),
  ('SNNPR', 'SNNPR Region'),
  ('ADDIS', 'Addis Ababa City Administration'),
  ('DIRE', 'Dire Dawa City Administration');
```

#### `facilities` table
```sql
CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES regions(id),
  code VARCHAR(20) UNIQUE NOT NULL,    -- "AMHARA_H001", "AMHARA_HC002"
  name VARCHAR(150) NOT NULL,          -- "Addis Alem Hospital", "Mersa Health Center"
  facility_type VARCHAR(50) NOT NULL,  -- 'Hospital', 'Health Center', 'Health Post', 'Clinic'
  boss_name VARCHAR(100),              -- Facility director/head name
  boss_email VARCHAR(100),             -- Facility director email
  boss_phone VARCHAR(20),              -- Facility director phone
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Constraints
  UNIQUE(region_id, code),
  CHECK (status IN ('active', 'inactive', 'archived'))
);

-- Example data
INSERT INTO facilities (region_id, code, name, facility_type, boss_name) VALUES
  ((SELECT id FROM regions WHERE code='AMHARA'), 'AMHARA_H001', 'Addis Alem Hospital', 'Hospital', 'Dr. Abebe'),
  ((SELECT id FROM regions WHERE code='AMHARA'), 'AMHARA_HC002', 'Mersa Health Center', 'Health Center', 'Sister Almaz'),
  ((SELECT id FROM regions WHERE code='OROMIA'), 'OROMIA_H001', 'Adama Hospital', 'Hospital', 'Dr. Kebede');
```

#### `departments` table (Optional - for standardization)
```sql
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now()
);

INSERT INTO departments (code, name) VALUES
  ('MCH', 'Maternal & Child Health'),
  ('TB', 'Tuberculosis'),
  ('HIV', 'HIV/AIDS & STI'),
  ('MALARIA', 'Malaria'),
  ('NUTRITION', 'Nutrition'),
  ('WASH', 'WASH'),
  ('NCD', 'Non-Communicable Diseases'),
  ('HSS', 'Health System Strengthening');
```

### 2. Extended User Profile Table

#### `profiles` table (Extended)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255),
  display_name VARCHAR(100),
  
  -- ORGANIZATIONAL HIERARCHY (NEW)
  region_id UUID NOT NULL REFERENCES regions(id),      -- NEW
  facility_id UUID NOT NULL REFERENCES facilities(id), -- NEW
  department VARCHAR(100),                             -- Keep existing
  
  -- ROLE & PERMISSIONS
  role VARCHAR(50) NOT NULL DEFAULT 'viewer', -- 'admin', 'regional_coordinator', 'facility_head', 'department_head', 'data_entry', 'viewer'
  
  -- STATUS & AUDIT
  verified BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  last_login TIMESTAMP,
  
  -- Constraints
  UNIQUE(id, facility_id, department),
  CHECK (role IN ('admin', 'regional_coordinator', 'facility_head', 'department_head', 'data_entry', 'viewer')),
  CHECK (status IN ('active', 'inactive', 'suspended')),
  FOREIGN KEY (region_id, facility_id) REFERENCES facilities(region_id, id)
);

-- Create index for fast lookups
CREATE INDEX idx_profiles_facility ON profiles(facility_id);
CREATE INDEX idx_profiles_region ON profiles(region_id);
CREATE INDEX idx_profiles_role ON profiles(role);
```

### 3. Data Tables with Organizational Context

#### `monthly_data` table (Extended)
```sql
CREATE TABLE monthly_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ORGANIZATIONAL CONTEXT (NEW)
  region_id UUID NOT NULL REFERENCES regions(id),          -- NEW
  facility_id UUID NOT NULL REFERENCES facilities(id),     -- NEW
  
  -- EXISTING FIELDS
  code VARCHAR(50) NOT NULL,       -- Indicator code
  month VARCHAR(20) NOT NULL,      -- "January", "February"
  department VARCHAR(100),         -- Keep existing
  actual INTEGER,
  target INTEGER,
  remarks TEXT,
  
  -- AUDIT
  submitted_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Constraints
  UNIQUE(region_id, facility_id, code, month),
  FOREIGN KEY (region_id, facility_id) REFERENCES facilities(region_id, id)
);

CREATE INDEX idx_monthly_data_facility ON monthly_data(facility_id);
CREATE INDEX idx_monthly_data_region ON monthly_data(region_id);
CREATE INDEX idx_monthly_data_submitted ON monthly_data(submitted_by);
```

#### `data_imports` table (Extended)
```sql
CREATE TABLE data_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ORGANIZATIONAL CONTEXT
  region_id UUID NOT NULL REFERENCES regions(id),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  
  -- IMPORT DETAILS
  file_name VARCHAR(255),
  file_path VARCHAR(255),
  import_type VARCHAR(50),  -- 'DHIS2', 'Excel', 'CSV'
  status VARCHAR(20),       -- 'pending', 'processing', 'success', 'failed'
  
  -- AUDIT
  imported_by UUID NOT NULL REFERENCES profiles(id),
  error_log TEXT,
  record_count INTEGER,
  created_at TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (region_id, facility_id) REFERENCES facilities(region_id, id)
);
```

## Updated RLS Policies

### Complete Security Policy Architecture

```sql
-- ============================================
-- 1. REGION-LEVEL RLS
-- ============================================

-- Regional coordinators see only their region
CREATE POLICY "Regional coordinators see their region"
  ON monthly_data FOR SELECT
  USING (
    region_id = (SELECT region_id FROM profiles WHERE id = auth.uid())
    AND
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'regional_coordinator'
  );

-- ============================================
-- 2. FACILITY-LEVEL RLS
-- ============================================

-- Facility heads see only their facility's data
CREATE POLICY "Facility heads see their facility data"
  ON monthly_data FOR SELECT
  USING (
    facility_id = (SELECT facility_id FROM profiles WHERE id = auth.uid())
    AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('facility_head', 'department_head')
  );

-- ============================================
-- 3. DEPARTMENT-LEVEL RLS
-- ============================================

-- Department heads see only their department data
CREATE POLICY "Department heads see their department"
  ON monthly_data FOR SELECT
  USING (
    department = (SELECT department FROM profiles WHERE id = auth.uid())
    AND
    facility_id = (SELECT facility_id FROM profiles WHERE id = auth.uid())
    AND
    region_id = (SELECT region_id FROM profiles WHERE id = auth.uid())
    AND
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'department_head'
  );

-- ============================================
-- 4. DATA ENTRY LEVEL RLS
-- ============================================

-- Data entry staff can only modify their facility's, department's data
CREATE POLICY "Data entry staff submit for their facility and department"
  ON monthly_data FOR INSERT
  WITH CHECK (
    facility_id = (SELECT facility_id FROM profiles WHERE id = auth.uid())
    AND
    region_id = (SELECT region_id FROM profiles WHERE id = auth.uid())
    AND
    department = (SELECT department FROM profiles WHERE id = auth.uid())
    AND
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('data_entry', 'department_head')
  );

-- ============================================
-- 5. ADMIN OVERRIDE
-- ============================================

-- Admins and superusers see all data
CREATE POLICY "Admins see all data"
  ON monthly_data FOR ALL
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin')
  );

-- ============================================
-- 6. VALIDATION TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION validate_organizational_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  user_region_id UUID;
  user_facility_id UUID;
  user_department VARCHAR;
  facility_region_id UUID;
BEGIN
  -- Get user's organizational assignment
  SELECT region_id, facility_id, department 
  INTO user_region_id, user_facility_id, user_department
  FROM profiles WHERE id = auth.uid();

  -- Verify facility exists and is in user's region
  IF NOT EXISTS (
    SELECT 1 FROM facilities 
    WHERE id = NEW.facility_id 
    AND region_id = NEW.region_id
  ) THEN
    RAISE EXCEPTION 'Facility does not exist in specified region';
  END IF;

  -- Enforce organizational boundaries
  IF NEW.region_id != user_region_id THEN
    RAISE EXCEPTION 'Cannot submit data for region: % (assigned to: %)', 
                    NEW.region_id, user_region_id;
  END IF;

  IF NEW.facility_id != user_facility_id THEN
    RAISE EXCEPTION 'Cannot submit data for facility: % (assigned to: %)', 
                    NEW.facility_id, user_facility_id;
  END IF;

  IF NEW.department != user_department THEN
    RAISE EXCEPTION 'Cannot submit data for department: % (assigned to: %)', 
                    NEW.department, user_department;
  END IF;

  -- Auto-populate submitted_by if not present
  IF NEW.submitted_by IS NULL THEN
    NEW.submitted_by = auth.uid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_monthly_data_hierarchy
BEFORE INSERT OR UPDATE ON monthly_data
FOR EACH ROW
EXECUTE FUNCTION validate_organizational_hierarchy();
```

## Frontend Implementation

### 1. Auth Form Updates

**File**: `src/pages/Auth.tsx`

```tsx
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Fetch regions and facilities from database
const [regions, setRegions] = useState([]);
const [facilities, setFacilities] = useState([]);
const [selectedRegion, setSelectedRegion] = useState("");
const [selectedFacility, setSelectedFacility] = useState("");
const [department, setDepartment] = useState("");

useEffect(() => {
  // Fetch regions
  supabase.from("regions").select("*").then(({ data }) => setRegions(data || []));
}, []);

useEffect(() => {
  // Fetch facilities for selected region
  if (selectedRegion) {
    supabase
      .from("facilities")
      .select("*")
      .eq("region_id", selectedRegion)
      .then(({ data }) => setFacilities(data || []));
  }
}, [selectedRegion]);

// In signup form:
<Select value={selectedRegion} onValueChange={setSelectedRegion}>
  <SelectTrigger><SelectValue placeholder="Select Region" /></SelectTrigger>
  <SelectContent>
    {regions.map((r) => (
      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
    ))}
  </SelectContent>
</Select>

<Select value={selectedFacility} onValueChange={setSelectedFacility}>
  <SelectTrigger><SelectValue placeholder="Select Facility" /></SelectTrigger>
  <SelectContent>
    {facilities.map((f) => (
      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
    ))}
  </SelectContent>
</Select>

// On signup:
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      display_name: displayName,
      region_id: selectedRegion,        // NEW
      facility_id: selectedFacility,    // NEW
      department: department,
      role: "viewer" // Always viewer
    }
  }
});
```

### 2. MonthlyDataTab Display Updates

**File**: `src/components/MonthlyDataTab.tsx`

```tsx
import { useAuth } from "@/hooks/useAuth";

export default function MonthlyDataTab({ monthlyData, setMonthlyData }: Props) {
  const { user, profile } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ORGANIZATIONAL CONTEXT BANNER */}
      {profile && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-blue-900">
              {profile.region}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-7">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <span className="text-indigo-900">
              {profile.facility}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-7">
            <Shield className="h-5 w-5 text-purple-600" />
            <span className="text-purple-900">
              {profile.department}
            </span>
          </div>
        </div>
      )}

      {/* REST OF COMPONENT */}
    </div>
  );
}
```

### 3. Dashboard Hierarchy Display

**New File**: `src/components/OrganizationalContext.tsx`

```tsx
import { Globe, Building2, Layers3, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface OrganizationalContextProps {
  region: string;
  facility: string;
  department: string;
  role: string;
}

export function OrganizationalContext({
  region,
  facility,
  department,
  role,
}: OrganizationalContextProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded">
            <Globe className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xs text-gray-600">Region</p>
              <p className="font-semibold text-blue-900">{region}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-xs text-gray-600">Facility</p>
              <p className="font-semibold text-indigo-900">{facility}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded">
            <Layers3 className="h-5 w-5 text-purple-600" />
            <div>
              <p className="text-xs text-gray-600">Department</p>
              <p className="font-semibold text-purple-900">{department}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-rose-50 rounded">
            <Shield className="h-5 w-5 text-rose-600" />
            <div>
              <p className="text-xs text-gray-600">Role</p>
              <p className="font-semibold text-rose-900 capitalize">{role.replace(/_/g, " ")}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Role Hierarchy & Permissions

| Role | Level | Permissions | Visibility |
|------|-------|-----------|-----------|
| **Admin** | National | Create regions/facilities, assign roles, view all data, audit logs | All |
| **Regional Coordinator** | Region | Monitor facilities in region, assign facility heads, view regional reports | Their region only |
| **Facility Head** | Facility | Manage staff, view facility dashboard, approve department submissions | Their facility only |
| **Department Head** | Department | Submit data, view department metrics, train data entry staff | Their facility's department |
| **Data Entry** | Department | Submit monthly data, view indicators | Their facility's department |
| **Viewer** | Any | Read-only access to assigned area | Assigned region/facility/dept |

## Implementation Timeline

### Phase 1: Backend Setup (Priority 1 - IMMEDIATE)
- [ ] Create regions reference table
- [ ] Create facilities reference table
- [ ] Create departments reference table (optional)
- [ ] Extend profiles with region_id, facility_id
- [ ] Extend monthly_data with region_id, facility_id
- [ ] Extend data_imports with region_id, facility_id

### Phase 2: RLS Policies (Priority 1 - IMMEDIATE)
- [ ] Create region-level RLS policies
- [ ] Create facility-level RLS policies
- [ ] Create department-level RLS policies
- [ ] Create role-based access policies
- [ ] Add admin bypass policies

### Phase 3: Frontend Updates (Priority 2 - Week 1)
- [ ] Update Auth.tsx for region/facility selection
- [ ] Update MonthlyDataTab to show hierarchy
- [ ] Create OrganizationalContext component
- [ ] Update DashboardTab for multi-facility views

### Phase 4: Admin Panel (Priority 2 - Week 1)
- [ ] Create facility management interface
- [ ] Create user role assignment interface
- [ ] Create regional coordinator dashboard
- [ ] Create audit log viewer

### Phase 5: Testing & Deploy (Priority 3 - Week 2)
- [ ] Test cross-facility access prevention
- [ ] Test RLS policies with sample users
- [ ] Load test multi-facility scenarios
- [ ] Deploy to production

## Security Checklist

- [ ] RLS policies block cross-region access
- [ ] RLS policies block cross-facility access
- [ ] Database trigger validates organizational hierarchy
- [ ] Audit logs show region + facility + department
- [ ] Users cannot change their assigned hierarchy
- [ ] Admin bypass properly restricted
- [ ] Each region/facility completely isolated
- [ ] Tested with production-like data volumes

## Example Queries for Verification

```sql
-- Query: All users in a facility
SELECT id, email, department, role FROM profiles 
WHERE facility_id = 'FACILITY_ID';

-- Query: All data submitted to a region
SELECT * FROM monthly_data 
WHERE region_id = 'REGION_ID';

-- Query: Most recent submissions
SELECT p.email, m.code, m.month, m.actual, m.created_at
FROM monthly_data m
JOIN profiles p ON m.submitted_by = p.id
WHERE m.facility_id = 'FACILITY_ID'
ORDER BY m.created_at DESC
LIMIT 10;

-- Query: Verify organization boundaries
SELECT r.name, f.name, COUNT(m.id) as submission_count
FROM monthly_data m
JOIN facilities f ON m.facility_id = f.id
JOIN regions r ON m.region_id = r.id
GROUP BY r.id, f.id;
```

## Migration Guide (If Upgrading Existing System)

For systems with existing data:

```sql
-- 1. Create new tables
-- [Create regions, facilities, departments tables]

-- 2. Migrate existing profiles
UPDATE profiles 
SET region_id = (SELECT id FROM regions WHERE code = 'DEFAULT_REGION' LIMIT 1),
    facility_id = (SELECT id FROM facilities WHERE code = 'DEFAULT_FACILITY' LIMIT 1);

-- 3. Add region/facility to existing data
UPDATE monthly_data
SET region_id = (SELECT region_id FROM profiles WHERE id = submitted_by),
    facility_id = (SELECT facility_id FROM profiles WHERE id = submitted_by)
WHERE region_id IS NULL;

-- 4. Enable constraints gradually
-- Test with sample data first
-- Then migrate remaining data
-- Finally enable NOT NULL constraints
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "RLS policy prevents SELECT" | User not in correct region | Verify facility_id matches profile |
| "Cannot submit data for region" | Organizational hierarchy mismatch | Database trigger catching violation |
| "Facilities list empty" | Region not selected | Ensure region_id is populated |
| "Cross-facility data visible" | RLS policy not applied | Verify policies exist on table |
| "Users see all regions" | Admin role bypass issue | Check role check in RLS policy |

## References

- Backend Schema: This document (SQL section)
- Frontend Components: [MonthlyDataTab.tsx](src/components/MonthlyDataTab.tsx)
- Security Policy: [DEPARTMENTAL_ACCESS_CONTROL.md](DEPARTMENTAL_ACCESS_CONTROL.md)
- Audit Logging: [securityUtils.ts](src/lib/securityUtils.ts)
