export interface KPIDefinition {
  id: number;
  name: string;
  target: number;
  weight: number;
  type: 'prop' | 'cat';
  measure?: string;
  rules?: { min: number; max: number; score: number }[];
}

export interface KPIRecord {
  id: string; // unique ID
  kpiId: number;
  month: string; // YYYY-MM
  actualValue: number;
  calculatedScore: number;
  gap: number;
  status: 'OK' | 'GAP';
}

export interface ActionPlan {
  id: string;
  kpiId: number;
  month: string;
  gapDescription: string;
  rootCause: string;
  correctiveAction: string;
  responsiblePerson: string;
  deadline: string;
  progress: 'Not started' | 'In progress' | 'Completed';
}

export interface UserProfile {
  name: string;
  role: string;
  hospital: string;
  cellNumber: string;
  email: string;
}

export interface Notification {
  id: string;
  month: string;
  message: string;
  status: 'unread' | 'read';
  createdAt: string;
}
