import { KPIDefinition, KPIRecord, ActionPlan, UserProfile } from './types';

export const INITIAL_USER_PROFILE: UserProfile = {
  name: "NUREDIN MUHAMMED",
  role: "PLAN COORDINATOR",
  hospital: "CHEFA ROBIT HOSPITAL",
  cellNumber: "0926703678",
  email: "nuredinmuhammed176@gmail.com"
};

export const INITIAL_KPIS: KPIDefinition[] = [
  {
    id: 1,
    name: "Clinical Audit score",
    target: 90,
    weight: 5,
    type: "prop",
    measure: "percent"
  },
  {
    id: 2,
    name: "QI graduated",
    target: 100,
    weight: 4,
    type: "prop",
    measure: "percent"
  },
  {
    id: 3,
    name: "IPC FLAT score",
    target: 100,
    weight: 4,
    type: "cat",
    measure: "num_qi_ph",
    rules: [
      { min: 2, max: 999, score: 4 },
      { min: 0, max: 1.9, score: 0 }
    ]
  },
  {
    id: 4,
    name: "Patient satisfaction",
    target: 88,
    weight: 4,
    type: "prop",
    measure: "percent"
  },
  {
    id: 5,
    name: "HAQ - 5th cycle",
    target: 88,
    weight: 7,
    type: "prop",
    measure: "percent"
  },
  {
    id: 6,
    name: "EHSIG",
    target: 100,
    weight: 10,
    type: "prop",
    measure: "percent"
  },
  {
    id: 7,
    name: "Essential laboratory tests",
    target: 100,
    weight: 7,
    type: "prop",
    measure: "percent"
  },
  {
    id: 8,
    name: "Imaging service interruption days",
    target: 0,
    weight: 3,
    type: "cat",
    measure: "days",
    rules: [
      { min: 0, max: 1, score: 3 },
      { min: 1.0001, max: 3, score: 2 },
      { min: 3.0001, max: 9999, score: 0 }
    ]
  },
  {
    id: 9,
    name: "Major OR table efficiency/table",
    target: 3,
    weight: 4,
    type: "cat",
    measure: "efficiency",
    rules: [
      { min: 3, max: 9999, score: 4 },
      { min: 1.8, max: 2.9999, score: 3 },
      { min: 1, max: 1.7999, score: 2 },
      { min: 0, max: 0.9999, score: 1 }
    ]
  },
  {
    id: 10,
    name: "Bed occupancy rate",
    target: 85,
    weight: 5,
    type: "cat",
    measure: "percent",
    rules: [
      { min: 0, max: 50, score: 0 },
      { min: 50.0001, max: 65, score: 2 },
      { min: 65.0001, max: 79.9, score: 3 },
      { min: 80, max: 999, score: 5 }
    ]
  },
  {
    id: 11,
    name: "Inpatient mortality rate",
    target: 1.8,
    weight: 5,
    type: "cat",
    measure: "percent",
    rules: [
      { min: 0, max: 1.8, score: 5 },
      { min: 1.8001, max: 2.5, score: 3 },
      { min: 2.5001, max: 999, score: 0 }
    ]
  },
  {
    id: 12,
    name: "Medical record completeness",
    target: 100,
    weight: 3,
    type: "prop",
    measure: "percent"
  },
  {
    id: 13,
    name: "OPD waiting time (minutes)",
    target: 45,
    weight: 2,
    type: "cat",
    measure: "minutes",
    rules: [
      { min: 0, max: 45, score: 2 },
      { min: 46, max: 50, score: 1 },
      { min: 50.0001, max: 9999, score: 0 }
    ]
  },
  {
    id: 14,
    name: "Clients with 100% prescribed drugs filled",
    target: 100,
    weight: 4,
    type: "prop",
    measure: "percent"
  },
  {
    id: 15,
    name: "GGI",
    target: 85,
    weight: 2,
    type: "cat",
    measure: "percent",
    rules: [
      { min: 85, max: 999, score: 2 },
      { min: 80, max: 84.9999, score: 1 },
      { min: 0, max: 79.9999, score: 0 }
    ]
  },
  {
    id: 16,
    name: "Emergency stay >24 hrs",
    target: 0,
    weight: 3,
    type: "cat",
    measure: "count_zero",
    rules: [
      { min: 0, max: 0, score: 3 },
      { min: 0.0001, max: 9999, score: 0 }
    ]
  },
  {
    id: 17,
    name: "Emergency mortality",
    target: 0.2,
    weight: 3,
    type: "cat",
    measure: "percent",
    rules: [
      { min: 0, max: 0.2, score: 5 },
      { min: 0.2001, max: 1, score: 3 },
      { min: 1.0001, max: 999, score: 0 }
    ]
  },
  {
    id: 18,
    name: "Oxygen stockout",
    target: 0,
    weight: 2,
    type: "cat",
    measure: "days",
    rules: [
      { min: 0, max: 0, score: 2 },
      { min: 0.0001, max: 999, score: 0 }
    ]
  },
  {
    id: 19,
    name: "Report completeness & timeliness",
    target: 100,
    weight: 5,
    type: "prop",
    measure: "percent"
  },
  {
    id: 20,
    name: "Average length of stay",
    target: 5,
    weight: 3,
    type: "cat",
    measure: "days",
    rules: [
      { min: 0, max: 5, score: 3 },
      { min: 5.0001, max: 7, score: 2 },
      { min: 7.0001, max: 9999, score: 0 }
    ]
  }
];

export const INITIAL_RECORDS: KPIRecord[] = [
  // 2025-11
  {
    id: "rec1",
    kpiId: 1, // Clinical Audit score
    month: "2025-11",
    actualValue: 88,
    calculatedScore: 97.78, // (88 / 90) * 100
    gap: 2,
    status: "GAP"
  },
  {
    id: "rec2",
    kpiId: 2, // QI graduated
    month: "2025-11",
    actualValue: 100,
    calculatedScore: 100,
    gap: 0,
    status: "OK"
  },
  {
    id: "rec3",
    kpiId: 10, // Bed occupancy rate
    month: "2025-11",
    actualValue: 82,
    calculatedScore: 5, // Categorical 5
    gap: 3,
    status: "GAP" // Target 85 > 82 actual
  },
  {
    id: "rec4",
    kpiId: 11, // Inpatient mortality rate
    month: "2025-11",
    actualValue: 2.0,
    calculatedScore: 3, // Categorical 3
    gap: -0.2, // Target 1.8 - 2.0 = -0.2 (Actually exceeds threshold so it's a GAP)
    status: "GAP"
  },
  {
    id: "rec5",
    kpiId: 4, // Patient satisfaction
    month: "2025-11",
    actualValue: 85,
    calculatedScore: 96.59, // (85 / 88) * 100
    gap: 3,
    status: "GAP"
  },
  // 2025-12
  {
    id: "rec6",
    kpiId: 1, // Clinical Audit score
    month: "2025-12",
    actualValue: 92,
    calculatedScore: 100, // Clamped to 100 max
    gap: -2,
    status: "OK"
  },
  {
    id: "rec7",
    kpiId: 2, // QI graduated
    month: "2025-12",
    actualValue: 100,
    calculatedScore: 100,
    gap: 0,
    status: "OK"
  },
  {
    id: "rec8",
    kpiId: 10, // Bed occupancy rate
    month: "2025-12",
    actualValue: 86,
    calculatedScore: 5,
    gap: -1,
    status: "OK"
  },
  {
    id: "rec9",
    kpiId: 11, // Inpatient mortality rate
    month: "2025-12",
    actualValue: 1.5,
    calculatedScore: 5,
    gap: 0.3,
    status: "OK"
  },
  {
    id: "rec10",
    kpiId: 18, // Oxygen stockout (Target 0)
    month: "2025-12",
    actualValue: 2,
    calculatedScore: 0,
    gap: -2,
    status: "GAP"
  },
  // 2025-Q2 (Quarterly Example)
  {
    id: "rec_q1",
    kpiId: 1, // Clinical Audit score
    month: "2025-Q2",
    actualValue: 91,
    calculatedScore: 100,
    gap: -1,
    status: "OK"
  },
  {
    id: "rec_q2",
    kpiId: 4, // Patient satisfaction
    month: "2025-Q2",
    actualValue: 80,
    calculatedScore: 90.91,
    gap: 8,
    status: "GAP"
  },
  {
    id: "rec_q3",
    kpiId: 10, // Bed occupancy rate
    month: "2025-Q2",
    actualValue: 78,
    calculatedScore: 3,
    gap: 7,
    status: "GAP"
  },
  // 2025-Year (Annual Example)
  {
    id: "rec_y1",
    kpiId: 6, // EHSIG
    month: "2025-Year",
    actualValue: 98,
    calculatedScore: 98,
    gap: 2,
    status: "GAP"
  },
  {
    id: "rec_y2",
    kpiId: 1, // Clinical Audit score
    month: "2025-Year",
    actualValue: 90,
    calculatedScore: 100,
    gap: 0,
    status: "OK"
  }
];

export const INITIAL_ACTION_PLANS: ActionPlan[] = [
  {
    id: "ap1",
    kpiId: 1, // Clinical Audit score
    month: "2025-11",
    gapDescription: "Actual score 88.0% is below the target of 90.0% (Gap of 2.0%)",
    rootCause: "Incomplete documentation of inpatient clinical charts and delayed files retrieval.",
    correctiveAction: "Initiate weekly audits, streamline clinical file archiving, and train nursing staff on core record compliance.",
    responsiblePerson: "Medical Director & Plan Coordinator",
    deadline: "2025-12-31",
    progress: "In progress"
  },
  {
    id: "ap2",
    kpiId: 10, // Bed occupancy rate
    month: "2025-11",
    gapDescription: "Actual percentage 82.0% is below the target of 85.0% (Gap of 3.0%)",
    rootCause: "Delayed patient discharge clearance and seasonal low admission rates in general medicine.",
    correctiveAction: "Improve coordination of discharge times and optimize bed allocation across emergency and inpatient units.",
    responsiblePerson: "Ward Head Nurse",
    deadline: "2025-12-15",
    progress: "Completed"
  },
  {
    id: "ap3",
    kpiId: 11, // Inpatient mortality rate
    month: "2025-11",
    gapDescription: "Actual mortality rate is 2.0%, exceeding the safety target threshold of 1.8%",
    rootCause: "Elevated high-severity emergency admissions and delayed triaging during weekend peak hours.",
    correctiveAction: "Enforce mandatory rapid triage protocols and optimize weekend shift staffing for emergency responders.",
    responsiblePerson: "Emergency Dept Head",
    deadline: "2025-12-31",
    progress: "Not started"
  }
];

// Helper to calculate score for a KPI
export function calculateKPIScore(kpi: KPIDefinition, actual: number): { score: number; gap: number; status: 'OK' | 'GAP' } {
  if (kpi.type === 'prop') {
    const rawScore = (actual / kpi.target) * 100;
    const score = parseFloat(Math.min(100, Math.max(0, rawScore)).toFixed(2));
    const gap = parseFloat((kpi.target - actual).toFixed(2));
    const status = actual >= kpi.target ? 'OK' : 'GAP';
    return { score, gap, status };
  } else {
    // Categorical
    let score = 0;
    if (kpi.rules) {
      for (const rule of kpi.rules) {
        if (actual >= rule.min && actual <= rule.max) {
          score = rule.score;
          break;
        }
      }
    }
    
    // Gap and Status definitions for categorical
    let gap = 0;
    let status: 'OK' | 'GAP' = 'OK';
    
    // In mortality and stockouts, higher values are gaps
    if (kpi.name.toLowerCase().includes("mortality") || kpi.name.toLowerCase().includes("interruption") || kpi.name.toLowerCase().includes("stockout") || kpi.name.toLowerCase().includes("waiting") || kpi.name.toLowerCase().includes("stay")) {
      gap = parseFloat((actual - kpi.target).toFixed(4));
      status = actual <= kpi.target ? 'OK' : 'GAP';
    } else {
      gap = parseFloat((kpi.target - actual).toFixed(4));
      status = actual >= kpi.target ? 'OK' : 'GAP';
    }

    return { score, gap, status };
  }
}

// Helper to format any period code to a human readable label
export function formatPeriod(period: string): string {
  if (!period) return '';
  // Monthly: e.g. "2025-11" -> "Nov 2025"
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-');
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const monthIdx = parseInt(month, 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${monthNames[monthIdx]} ${year}`;
    }
  }
  // Quarterly: e.g. "2025-Q1" -> "Q1 2025"
  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const [year, quarter] = period.split('-');
    return `${quarter} ${year}`;
  }
  // Annually: e.g. "2025-Year" -> "Annual FY 2025"
  if (period.endsWith('-Year')) {
    const year = period.split('-')[0];
    return `Annual FY ${year}`;
  }
  return period;
}

// Helper to extract the core fiscal year string for filtering
export function getFiscalYear(period: string): string {
  if (!period) return 'N/A';
  const match = period.match(/^(\d{4})/);
  return match ? `FY ${match[1]}` : 'N/A';
}

// Helper to check what reporting type a period is
export function getPeriodType(period: string): 'Monthly' | 'Quarterly' | 'Annually' | 'Other' {
  if (/^\d{4}-\d{2}$/.test(period)) return 'Monthly';
  if (/^\d{4}-Q[1-4]$/.test(period)) return 'Quarterly';
  if (period.endsWith('-Year')) return 'Annually';
  return 'Other';
}

