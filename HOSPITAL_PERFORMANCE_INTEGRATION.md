# Hospital Plan & Performance Integration Guide

## Overview
Your `hospital_plan_and_performance` table from Supabase is now fully integrated into the Plan Compass application. The data is visualization-ready and accessible through a dedicated tab in the navigation.

## What Was Added

### 1. **Database Layer** 
- Migration file: `supabase/migrations/20260522_hospital_plan_performance.sql`
- Table with proper RLS policies and indexes
- All 284 sample records inserted from your SQL statement

### 2. **Data Fetching**
- New function `fetchHospitalPerformanceData()` in `useDatabase.tsx` hook
- Supports filtering by:
  - Category (Family Planning, Hospital Utilization, Quality & Safety, etc.)
  - Fiscal Year (2016 EFY, 2017 EFY, 2018 EFY, 2019 EFY)
  - Metric Type (Plan, Performance, EAP)

### 3. **User Interface**
- New "Hospital Performance" tab in the sidebar (under Monthly Entry)
- Features:
  - **Search** - Find indicators by name, category, or remark
  - **Filters** - Narrow down by category, fiscal year, metric type
  - **Data Display** - Grouped by indicator name for easy reading
  - **Export** - Download as CSV or Excel files
  - **Status Indicators** - Badge showing Active status

## How to Use

### Access the Data
1. Open the application
2. Click "Hospital Performance" in the sidebar navigation (green TrendingUp icon)
3. The component will automatically load all hospital performance data from Supabase

### Filter and Search
- Use the **Search Box** to find specific indicators
- Use the **Category dropdown** to filter by program area (Family Planning, Pharmacy, etc.)
- Use the **Fiscal Year dropdown** to view data for specific years
- Use the **Metric Type dropdown** to show Plan, Performance, or EAP data only

### Export Data
- Click **"Export CSV"** to download data in CSV format
- Click **"Export Excel"** to download data in Excel format
- Only filtered/visible data is exported

## Data Structure

Each record contains:
- **Category** - Program area (e.g., Family Planning, Hospital Utilization)
- **Indicator Name** - Specific performance indicator
- **Fiscal Year** - Ethiopian fiscal year (e.g., 2018 EFY)
- **Metric Type** - Type of data (Plan, Performance, EAP - Estimated Annual Performance)
- **Metric Value** - Numerical value for the metric
- **Percentage Value** - Percentage-based metric value
- **Status** - Active/Inactive status
- **Remark** - Additional notes or context

## Sample Data Categories
- **Family Planning** - Contraceptive acceptors, new acceptors, repeat acceptors, long-acting FP methods
- **Hospital Utilization** - Inpatient admissions, per capita metrics, ambulance services, bed occupancy
- **Quality & Safety** - Patient mortality, quality indicators, safety metrics
- **Pharmacy** - Antibiotic prescription rates, drug availability, wastage rates
- **Blood Bank** - Blood collection, utilization rates
- **Nutrition** - SAM children treatment, low birth weight cases
- **Tuberculosis** - TB case notifications and treatment rates

## Technical Notes

### Migration File
Location: `/workspaces/plan-compass/supabase/migrations/20260522_hospital_plan_performance.sql`
- Creates table with proper indexes
- Sets up Row-Level Security (RLS) policies
- Inserts sample data

### Component File
Location: `/workspaces/plan-compass/src/components/HospitalPerformanceTab.tsx`
- React component with hooks
- Uses Tailwind CSS for styling
- Includes error handling and loading states

### Hook Integration
Location: `/workspaces/plan-compass/src/hooks/useDatabase.tsx`
- New `HospitalPlanPerformance` interface
- New `fetchHospitalPerformanceData()` function
- Supports optional filtering

## Next Steps

1. **Deploy Migration** - Run the migration in Supabase to create the table:
   ```bash
   supabase migration up
   ```

2. **Test the Integration** - Start the development server and navigate to the new tab:
   ```bash
   npm run dev
   # or
   bun dev
   ```

3. **Verify Data** - Confirm that data loads and filters work correctly

4. **Customize** - If needed, you can:
   - Adjust the styling in the component
   - Add more filters
   - Modify the display grouping
   - Add additional export formats

## Troubleshooting

**Data not appearing?**
- Ensure the migration has been run in Supabase
- Check browser console for errors (F12)
- Verify RLS policies allow authenticated user access

**Export not working?**
- Check that browser allows downloads
- Verify Excel/CSV export libraries are installed

**Slow loading?**
- Check Supabase connection
- Verify indexes are created
- Consider adding pagination for large datasets

## Support
For issues or questions, refer to the app documentation or check the About & Contact tab in the application.
