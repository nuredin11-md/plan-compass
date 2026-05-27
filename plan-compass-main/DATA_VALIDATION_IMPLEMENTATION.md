# Context-Aware Data Filtering & Validation Implementation

## Overview

This implementation establishes a strict, context-aware data filtering and validation system that ensures:
1. **Scope & Precision Filtering**: Data is filtered by specific time-periods and entity levels
2. **"Zero-Data" Enforcement**: System distinguishes between "Zero Performance" and "Missing Data"
3. **Conditional Feedback Generation**: Feedback and alerts only generate when valid data exists

## New Files Created

### 1. `/src/lib/dataValidation.ts`
**Purpose**: Core validation utility library

**Key Functions**:

#### Data Validation
- `validateIndicatorData()` - Validates if an indicator has data for a specific period
  - Returns: `DataValidationResult` with dataType: "complete" | "missing" | "zero"
  - Distinguishes between:
    - **Complete**: Data exists and is valid
    - **Zero**: Data submitted but value is 0
    - **Missing**: No data submitted for the period

- `validateDepartmentData()` - Validates all indicators in a department
  - Returns counts: `completeCount`, `missingCount`, `zeroCount`
  - Helps identify data completeness percentage

#### Period Management
- `getPeriodRange()` - Gets month indices for a specific period
- `getMonthsInPeriod()` - Returns list of months in a period
- `getDataByPeriod()` - Retrieves entries for a specific period
- `getActualByPeriod()` - Calculates actual value (returns `null` if no data)

#### Feedback Control
- `shouldGenerateFeedback()` - Determines if feedback should be generated
  - Checks data completeness against minimum threshold (default: 70%)
  - Returns: `shouldGenerate` flag + completion percentage + reason
  - Only generates if sufficient valid data exists

#### User Messages
- `getEmptyStateMessage()` - Returns appropriate message for missing data
- `formatValidationMessage()` - Formats validation results for UI display

### 2. `/src/components/EmptyDataState.tsx`
**Purpose**: Unified empty state component for all no-data scenarios

**Features**:
- Three context types: `indicator`, `department`, `period`
- Contextual messages with period and entity information
- Optional retry button
- Helpful tip about data submission
- Consistent styling and icons

## Modified Files

### 1. `/src/components/FeedbackTab.tsx`

**Changes Made**:

#### Import Updates
- Added `validateDepartmentData()` and `shouldGenerateFeedback()` from validation utility
- Added `EmptyDataState` component
- Added `useCallback` to hooks

#### State & Validation
- Added `dataValidation` Map to track validation status per department
- Validates data completeness for each department/period
- Checks minimum 70% data completion threshold before generating feedback

#### UI Updates

**Annual Feedback Tab**:
- Shows `EmptyDataState` if no data exists at all
- Shows `EmptyDataState` if no departments have data
- For each department:
  - Displays data completeness warning if below threshold
  - Only shows "Performance Feedback" section if data is sufficient
  - Shows "Feedback will be generated once sufficient data is submitted" when incomplete
  - Full feedback narrative only displays for departments with valid data

**Periodic Performance Tab**:
- Shows `EmptyDataState` if no data exists for the selected period
- For each department:
  - Shows recommendation only if data is sufficient
  - Shows "Analysis will be available once sufficient data is submitted" when incomplete
  - Displays critical issues only when data validation passes

### 2. `/src/components/DashboardTab.tsx`

**Changes Made**:

#### Import Updates
- Removed `getActualYTD` (year-to-date aggregation)
- Added period-based filtering functions from validation utility
- Added `Select` component for period selection
- Added `EmptyDataState` component

#### State Management
- Added `selectedPeriod` state (default: "quarterly")
- Added `selectedMonth` state (for specific period reference)

#### Data Calculation Updates
- **Stats**: Only counts indicators with valid data for the selected period
  - Added `withData` counter to show how many indicators have data
- **Program Summary**: Filters by period instead of year-to-date
- **Trend Data**: Uses period-specific months instead of hardcoded last 6 months

#### UI Enhancements

**Period Selector**:
- New control panel for period selection
- Shows "Reference Month" selector for monthly/quarterly/semi-annual periods
- Allows users to filter analysis by specific timeframe

**Data Availability Check**:
- Displays warning if no data exists for selected period
- Shows helpful message directing users to select different period or complete data entry

**Conditional Rendering**:
- All analysis cards only render when `hasPeriodData === true`
- Shows `EmptyDataState` when no data exists
- Summary card shows "With Data" count to indicate partial data scenarios

## Data Flow Architecture

```
User Selection (Period + Month/Area)
    ↓
Data Retrieval (getDataByPeriod)
    ↓
Validation Check (validateIndicatorData/validateDepartmentData)
    ↓
Sufficiency Assessment (shouldGenerateFeedback)
    ↓
Conditional Rendering:
    ├─ Valid Data → Display Analysis + Feedback
    ├─ Partial Data → Display Warning + Conditional Feedback
    └─ No Data → Display EmptyDataState
```

## Key Validation Rules

### 1. Time-Period Filtering
- **Monthly**: Single month data
- **Quarterly**: 3-month period (months 0-2, 3-5, 6-8, 9-11)
- **Semi-annual**: 6-month period
- **Annual**: All 12 months

### 2. Zero-Data Differentiation
```
No Data Submitted
├─ No entries in monthlyData
└─ All entries are null/undefined
    ↓
Empty State: "No Entry Recorded"

Zero Performance
├─ Entries exist
└─ Actual value === 0
    ↓
Valid Data: Shown as "Zero Performance"
```

### 3. Feedback Generation Threshold
- Default minimum: 70% of indicators must have valid data
- Feedback halts and shows warning if below threshold
- Recommendations only display when threshold is met

## User Experience Improvements

### Before Implementation
- ❌ All analysis displayed regardless of data availability
- ❌ No distinction between missing data and zero performance
- ❌ Feedback generated even with missing data
- ❌ Year-to-date only (no period flexibility)
- ❌ No guidance on data completion status

### After Implementation
- ✅ Analysis only shown when data is available
- ✅ Clear "Data Not Found" vs "Zero Performance" messages
- ✅ Feedback halted until sufficient data exists
- ✅ Period-based filtering with month selection
- ✅ Data completeness warnings and guidance
- ✅ Contextual empty states for each scenario

## Testing Scenarios

### Scenario 1: No Data Submitted
```
Result: EmptyDataState displayed
Message: "No data has been recorded for the selected period"
Action: User prompted to select different period or complete data entry
```

### Scenario 2: Partial Data (30% Missing)
```
Result: Analysis displayed with warnings
Warning: "Warning: 3 indicator(s) have missing data. 70% data completion achieved."
Action: Feedback includes note about missing indicators
```

### Scenario 3: Zero Performance (Data Submitted, Value = 0)
```
Result: Analysis displayed normally
Status: Shows "Off Track (<70%)" with zero value
Feedback: Included in performance analysis
```

### Scenario 4: Complete Data
```
Result: Full analysis and feedback displayed
Status: All components rendered with recommendations
Performance Plan: Generated with specific improvement suggestions
```

## Configuration

### Adjustable Parameters

**In `shouldGenerateFeedback()`**:
```typescript
// Default minimum data completion: 70%
minCompletionThreshold: number = 0.8  // 80%
```

**In `validateDepartmentData()`**:
```typescript
// Period filtering
period: "monthly" | "quarterly" | "semiannual" | "annual"
monthIndex: number  // 0-11 for reference month
```

## Future Enhancements

1. **Audit Trail**: Log when data becomes available/unavailable
2. **Alerts**: Notify managers when critical indicators are missing
3. **Export Validation**: Include completeness metrics in exports
4. **SLA Tracking**: Monitor data submission deadlines
5. **Predictive Alerts**: Warn before deadline if data is incomplete
