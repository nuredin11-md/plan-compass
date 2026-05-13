# Context-Aware Data Validation - Developer Reference Guide

## Quick Start

### Using Validation in Your Code

```typescript
import { 
  validateIndicatorData, 
  validateDepartmentData,
  shouldGenerateFeedback,
  getActualByPeriod,
  getDataByPeriod,
  getMonthsInPeriod
} from "@/lib/dataValidation";

// Validate a single indicator
const result = validateIndicatorData(
  indicator, 
  monthlyData, 
  "quarterly", 
  5  // reference month
);

if (result.hasData && result.dataType === "complete") {
  // Show analysis
} else if (result.dataType === "zero") {
  // Show zero performance
} else {
  // Show empty state
}
```

### Conditional Feedback Rendering

```typescript
const feedbackValidation = shouldGenerateFeedback(
  departmentIndicators,
  monthlyData,
  timePeriod,
  0,
  0.7  // 70% threshold
);

if (feedbackValidation.shouldGenerate) {
  // Display feedback
} else {
  // Show warning message
  console.warn(feedbackValidation.reason);
}
```

## API Reference

### Core Functions

#### `validateIndicatorData()`
```typescript
function validateIndicatorData(
  indicator: Indicator,
  monthlyData: MonthlyEntry[],
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex?: number  // 0-11, default: 0
): DataValidationResult
```

**Returns**:
```typescript
{
  hasData: boolean;
  dataType: "complete" | "missing" | "zero";
  message: string;
  entries: MonthlyEntry[];
}
```

#### `validateDepartmentData()`
```typescript
function validateDepartmentData(
  departmentIndicators: Indicator[],
  monthlyData: MonthlyEntry[],
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex?: number
): {
  allValid: boolean;
  completeCount: number;
  missingCount: number;
  zeroCount: number;
  validationResults: Map<string, DataValidationResult>;
}
```

#### `shouldGenerateFeedback()`
```typescript
function shouldGenerateFeedback(
  departmentIndicators: Indicator[],
  monthlyData: MonthlyEntry[],
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex?: number,
  minCompletionThreshold?: number  // 0.7 = 70%
): {
  shouldGenerate: boolean;
  completionPercentage: number;
  reason: string;
}
```

#### `getActualByPeriod()`
```typescript
function getActualByPeriod(
  monthlyData: MonthlyEntry[],
  indicatorCode: string,
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex?: number
): number | null  // null if no data exists
```

#### `getDataByPeriod()`
```typescript
function getDataByPeriod(
  monthlyData: MonthlyEntry[],
  indicatorCode: string,
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex?: number
): MonthlyEntry[]
```

#### `getMonthsInPeriod()`
```typescript
function getMonthsInPeriod(
  period: "monthly" | "quarterly" | "semiannual" | "annual",
  monthIndex?: number  // 0-11
): string[]
```

### UI Components

#### `<EmptyDataState />`
```typescript
interface EmptyDataStateProps {
  type: "indicator" | "department" | "period";
  period?: string;        // e.g., "quarterly"
  name?: string;          // e.g., "Maternal & Child Health"
  showActionButton?: boolean;
  onRetry?: () => void;
}

// Usage
<EmptyDataState 
  type="department" 
  period="quarterly" 
  name="Maternal & Child Health"
  showActionButton={true}
  onRetry={() => refetchData()}
/>
```

## Common Patterns

### Pattern 1: Period-Based Analysis
```typescript
const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "quarterly" | "semiannual" | "annual">("quarterly");
const [selectedMonth, setSelectedMonth] = useState(0);

const actual = getActualByPeriod(monthlyData, indicatorCode, selectedPeriod, selectedMonth);

if (actual === null) {
  // Show empty state
} else if (actual === 0) {
  // Show zero performance
} else {
  // Show normal analysis
}
```

### Pattern 2: Department Data Validation
```typescript
const validation = validateDepartmentData(departmentIndicators, monthlyData, period);

const dataCompleteness = (validation.completeCount / departmentIndicators.length) * 100;

if (dataCompleteness < 70) {
  // Show incomplete data warning
  // Disable feedback generation
} else {
  // Generate feedback
}
```

### Pattern 3: Conditional Rendering
```typescript
const feedbackCheck = shouldGenerateFeedback(
  indicators,
  monthlyData,
  timePeriod,
  0,
  0.7
);

return (
  <>
    {feedbackCheck.shouldGenerate ? (
      <PerformanceFeedback data={data} />
    ) : (
      <>
        <WarningMessage reason={feedbackCheck.reason} />
        <PartialAnalysis data={data} />
      </>
    )}
  </>
);
```

## Type Definitions

```typescript
export interface DataValidationResult {
  hasData: boolean;
  dataType: "complete" | "missing" | "zero";
  message: string;
  entries: MonthlyEntry[];
}

export interface PeriodRange {
  startMonth: number;
  endMonth: number;
  monthCount: number;
}
```

## Error Handling

```typescript
try {
  const actual = getActualByPeriod(monthlyData, code, period, month);
  
  if (actual === null) {
    // No data - show empty state
    setMessage("Data not submitted for this period");
  } else if (actual === 0) {
    // Zero performance - valid data
    setMessage("Zero performance recorded");
  } else {
    // Process actual value
    const percent = (actual / target) * 100;
    setStatus(getStatus(percent));
  }
} catch (error) {
  console.error("Validation error:", error);
  setMessage("Error validating data");
}
```

## Testing Guidelines

### Test Data Scenarios

```typescript
// Scenario 1: No data submitted
const monthlyData = [];
const result = validateIndicatorData(indicator, monthlyData, "quarterly", 0);
expect(result.hasData).toBe(false);
expect(result.dataType).toBe("missing");

// Scenario 2: Zero performance
const monthlyData = [
  { code: "TEST_01", month: "Hamle (Nov)", actual: 0, remarks: "" },
  { code: "TEST_01", month: "Nehase (Dec)", actual: 0, remarks: "" },
  { code: "TEST_01", month: "Meskerem (Jan)", actual: 0, remarks: "" },
];
const result = validateIndicatorData(indicator, monthlyData, "quarterly", 0);
expect(result.hasData).toBe(true);
expect(result.dataType).toBe("zero");

// Scenario 3: Valid data
const monthlyData = [
  { code: "TEST_01", month: "Hamle (Nov)", actual: 50, remarks: "" },
  { code: "TEST_01", month: "Nehase (Dec)", actual: 75, remarks: "" },
  { code: "TEST_01", month: "Meskerem (Jan)", actual: 100, remarks: "" },
];
const result = validateIndicatorData(indicator, monthlyData, "quarterly", 0);
expect(result.hasData).toBe(true);
expect(result.dataType).toBe("complete");
```

## Performance Considerations

- **Memoization**: Use `useMemo()` for validation calculations
- **Lazy Evaluation**: Only validate when data changes
- **Batch Validation**: Validate multiple indicators at once with `validateDepartmentData()`

```typescript
// Good - memoized
const validation = useMemo(() => {
  return validateDepartmentData(indicators, monthlyData, period);
}, [monthlyData, period]);

// Avoid - recalculates every render
const validation = validateDepartmentData(indicators, monthlyData, period);
```

## Migration Guide

### If You Were Using `getActualYTD()`
```typescript
// Old
const actual = getActualYTD(code, monthlyData);
const percent = (actual / target) * 100;

// New
const actual = getActualByPeriod(monthlyData, code, "annual", 0);
if (actual === null) {
  // No data - handle separately
} else {
  const percent = (actual / target) * 100;
}
```

## Troubleshooting

**Issue**: Feedback not showing in Feedback Tab
- **Solution**: Check `shouldGenerateFeedback()` return value and data completion percentage

**Issue**: Empty state shows but data exists
- **Solution**: Verify `monthlyData` entries have non-null `actual` values

**Issue**: Period selection not working
- **Solution**: Ensure month index is 0-11 (not 1-12)

**Issue**: Zero performance treated as missing data
- **Solution**: Ensure `actual: 0` is explicitly set in `monthlyData`, not `null`
