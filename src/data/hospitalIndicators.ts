export interface Indicator {
  code: string;
  programArea: string;
  subProgram: string;
  indicator: string;
  unit: string;
  baseline: number;
  target: number;
}

export interface MonthlyEntry {
  code: string;
  month: string;
  actual: number | null;
  remarks: string;
}

// Ethiopian Financial Year: Hamle (July) to Sene (June)
// Mapped to Gregorian months starting from November
export const MONTHS = [
  "Hamle (Nov)", "Nehase (Dec)", "Meskerem (Jan)", "Tikimt (Feb)",
  "Hidar (Mar)", "Tahsas (Apr)", "Tir (May)", "Yekatit (Jun)",
  "Megabit (Jul)", "Miyazia (Aug)", "Ginbot (Sep)", "Sene (Oct)"
];

export const indicators: Indicator[] = [
  // Maternal & Child Health – Family Planning
  { code: "MCH_FP_01", programArea: "Maternal & Child Health", subProgram: "Family Planning", indicator: "Number of family planning service users", unit: "#", baseline: 154, target: 250 },
  { code: "MCH_FP_02", programArea: "Maternal & Child Health", subProgram: "Family Planning", indicator: "Immediate postpartum family planning (IPPFP) uptake within 48hrs", unit: "#", baseline: 35, target: 40 },
  { code: "MCH_FP_03", programArea: "Maternal & Child Health", subProgram: "Family Planning", indicator: "Long-acting reversible contraceptive (LARC) acceptance rate", unit: "%", baseline: 28, target: 45 },
  { code: "MCH_FP_04", programArea: "Maternal & Child Health", subProgram: "Family Planning", indicator: "Male involvement in family planning counseling sessions", unit: "#", baseline: 12, target: 30 },

  // Maternal & Child Health – ANC
  { code: "MCH_ANC_01", programArea: "Maternal & Child Health", subProgram: "ANC", indicator: "First ANC visit before 12 weeks gestation", unit: "#", baseline: 39, target: 165 },
  { code: "MCH_ANC_02", programArea: "Maternal & Child Health", subProgram: "ANC", indicator: "Pregnant women completing 4+ ANC visits", unit: "#", baseline: 120, target: 200 },
  { code: "MCH_ANC_03", programArea: "Maternal & Child Health", subProgram: "ANC", indicator: "ANC clients tested for HIV", unit: "#", baseline: 98, target: 180 },
  { code: "MCH_ANC_04", programArea: "Maternal & Child Health", subProgram: "ANC", indicator: "Pregnant women receiving iron/folic acid supplementation", unit: "#", baseline: 130, target: 200 },
  { code: "MCH_ANC_05", programArea: "Maternal & Child Health", subProgram: "ANC", indicator: "High-risk pregnancies identified and referred", unit: "#", baseline: 15, target: 25 },

  // Maternal & Child Health – Delivery
  { code: "MCH_DEL_01", programArea: "Maternal & Child Health", subProgram: "Delivery Services", indicator: "Facility-based deliveries (skilled attendance)", unit: "#", baseline: 180, target: 300 },
  { code: "MCH_DEL_02", programArea: "Maternal & Child Health", subProgram: "Delivery Services", indicator: "Caesarean section rate", unit: "%", baseline: 18, target: 15 },
  { code: "MCH_DEL_03", programArea: "Maternal & Child Health", subProgram: "Delivery Services", indicator: "Active management of third stage of labor (AMTSL) compliance", unit: "%", baseline: 75, target: 95 },
  { code: "MCH_DEL_04", programArea: "Maternal & Child Health", subProgram: "Delivery Services", indicator: "Neonatal deaths within 24 hours of birth", unit: "#", baseline: 8, target: 3 },

  // Maternal & Child Health – PNC
  { code: "MCH_PNC_01", programArea: "Maternal & Child Health", subProgram: "Postnatal Care", indicator: "Postnatal care visit within 48 hours of delivery", unit: "#", baseline: 95, target: 250 },
  { code: "MCH_PNC_02", programArea: "Maternal & Child Health", subProgram: "Postnatal Care", indicator: "Exclusive breastfeeding counseling at PNC", unit: "#", baseline: 80, target: 200 },

  // Child Health – Nutrition
  { code: "CH_NUT_01", programArea: "Child Health", subProgram: "Child Nutrition", indicator: "Under-five children receiving growth monitoring", unit: "#", baseline: 247, target: 796 },
  { code: "CH_NUT_02", programArea: "Child Health", subProgram: "Child Nutrition", indicator: "Children with severe acute malnutrition (SAM) treated", unit: "#", baseline: 18, target: 25 },
  { code: "CH_NUT_03", programArea: "Child Health", subProgram: "Child Nutrition", indicator: "Children 6–23 months receiving complementary feeding counseling", unit: "#", baseline: 60, target: 150 },
  { code: "CH_NUT_04", programArea: "Child Health", subProgram: "Child Nutrition", indicator: "Vitamin A supplementation coverage (6–59 months)", unit: "%", baseline: 65, target: 90 },

  // Child Health – Immunization
  { code: "CH_IMM_01", programArea: "Child Health", subProgram: "Immunization", indicator: "Penta-3 vaccination coverage (under 1 year)", unit: "%", baseline: 78, target: 95 },
  { code: "CH_IMM_02", programArea: "Child Health", subProgram: "Immunization", indicator: "Measles vaccination coverage (9 months)", unit: "%", baseline: 72, target: 90 },
  { code: "CH_IMM_03", programArea: "Child Health", subProgram: "Immunization", indicator: "Fully immunized children (under 1 year)", unit: "#", baseline: 180, target: 350 },
  { code: "CH_IMM_04", programArea: "Child Health", subProgram: "Immunization", indicator: "Immunization dropout rate (Penta1 to Measles)", unit: "%", baseline: 12, target: 5 },

  // Child Health – IMNCI
  { code: "CH_IMNCI_01", programArea: "Child Health", subProgram: "IMNCI", indicator: "Under-five OPD visits managed per IMNCI protocol", unit: "#", baseline: 320, target: 600 },
  { code: "CH_IMNCI_02", programArea: "Child Health", subProgram: "IMNCI", indicator: "Pneumonia cases treated with appropriate antibiotics", unit: "#", baseline: 45, target: 80 },

  // Communicable Disease – HIV/AIDS
  { code: "CD_HIV_01", programArea: "Communicable Disease", subProgram: "HIV/AIDS", indicator: "HIV testing and counseling (HTC) sessions", unit: "#", baseline: 450, target: 800 },
  { code: "CD_HIV_02", programArea: "Communicable Disease", subProgram: "HIV/AIDS", indicator: "PLHIV currently on ART", unit: "#", baseline: 120, target: 150 },
  { code: "CD_HIV_03", programArea: "Communicable Disease", subProgram: "HIV/AIDS", indicator: "PMTCT: HIV+ pregnant women receiving ARV prophylaxis", unit: "#", baseline: 8, target: 12 },
  { code: "CD_HIV_04", programArea: "Communicable Disease", subProgram: "HIV/AIDS", indicator: "Viral load suppression rate among ART clients", unit: "%", baseline: 75, target: 90 },

  // Communicable Disease – TB
  { code: "CD_TB_01", programArea: "Communicable Disease", subProgram: "Tuberculosis", indicator: "TB cases detected (all forms)", unit: "#", baseline: 55, target: 80 },
  { code: "CD_TB_02", programArea: "Communicable Disease", subProgram: "Tuberculosis", indicator: "TB treatment success rate", unit: "%", baseline: 82, target: 90 },
  { code: "CD_TB_03", programArea: "Communicable Disease", subProgram: "Tuberculosis", indicator: "TB/HIV co-infected patients on both treatments", unit: "#", baseline: 6, target: 10 },

  // Communicable Disease – Malaria
  { code: "CD_MAL_01", programArea: "Communicable Disease", subProgram: "Malaria", indicator: "Confirmed malaria cases treated with ACT within 24hrs", unit: "#", baseline: 300, target: 500 },
  { code: "CD_MAL_02", programArea: "Communicable Disease", subProgram: "Malaria", indicator: "Malaria rapid diagnostic test (RDT) positivity rate", unit: "%", baseline: 35, target: 20 },
  { code: "CD_MAL_03", programArea: "Communicable Disease", subProgram: "Malaria", indicator: "IPTp-2 coverage for pregnant women", unit: "%", baseline: 40, target: 70 },

  // Non-Communicable Disease
  { code: "NCD_01", programArea: "Non-Communicable Disease", subProgram: "Chronic Care", indicator: "Hypertension patients enrolled in chronic care", unit: "#", baseline: 85, target: 200 },
  { code: "NCD_02", programArea: "Non-Communicable Disease", subProgram: "Chronic Care", indicator: "Diabetes patients with controlled blood sugar (HbA1c <7%)", unit: "%", baseline: 40, target: 65 },
  { code: "NCD_03", programArea: "Non-Communicable Disease", subProgram: "Chronic Care", indicator: "Cervical cancer screening (VIA/HPV)", unit: "#", baseline: 50, target: 150 },
  { code: "NCD_04", programArea: "Non-Communicable Disease", subProgram: "Mental Health", indicator: "Mental health consultations provided", unit: "#", baseline: 22, target: 60 },

  // Surgery & Emergency
  { code: "SURG_01", programArea: "Surgery & Emergency", subProgram: "Surgical Services", indicator: "Major surgical procedures performed", unit: "#", baseline: 120, target: 180 },
  { code: "SURG_02", programArea: "Surgery & Emergency", subProgram: "Surgical Services", indicator: "Surgical site infection rate", unit: "%", baseline: 8, target: 3 },
  { code: "SURG_03", programArea: "Surgery & Emergency", subProgram: "Emergency", indicator: "Emergency triage completed within 5 minutes of arrival", unit: "%", baseline: 60, target: 90 },
  { code: "SURG_04", programArea: "Surgery & Emergency", subProgram: "Emergency", indicator: "Emergency referral-out cases", unit: "#", baseline: 45, target: 30 },

  // Quality & Patient Safety
  { code: "QPS_01", programArea: "Quality & Patient Safety", subProgram: "Infection Prevention", indicator: "Hand hygiene compliance rate", unit: "%", baseline: 55, target: 85 },
  { code: "QPS_02", programArea: "Quality & Patient Safety", subProgram: "Infection Prevention", indicator: "Healthcare-associated infection (HAI) incidence rate", unit: "%", baseline: 6, target: 2 },
  { code: "QPS_03", programArea: "Quality & Patient Safety", subProgram: "Patient Satisfaction", indicator: "Patient satisfaction score (exit survey)", unit: "%", baseline: 68, target: 85 },
  { code: "QPS_04", programArea: "Quality & Patient Safety", subProgram: "Mortality Review", indicator: "Maternal death review meetings conducted", unit: "#", baseline: 3, target: 12 },
  { code: "QPS_05", programArea: "Quality & Patient Safety", subProgram: "Mortality Review", indicator: "Institutional mortality rate (inpatient)", unit: "%", baseline: 4, target: 2 },

  // Pharmacy & Supply Chain
  { code: "PSC_01", programArea: "Pharmacy & Supply Chain", subProgram: "Drug Availability", indicator: "Tracer drug availability rate", unit: "%", baseline: 72, target: 95 },
  { code: "PSC_02", programArea: "Pharmacy & Supply Chain", subProgram: "Drug Availability", indicator: "Medicines stock-out days (essential drugs)", unit: "#", baseline: 30, target: 5 },
  { code: "PSC_03", programArea: "Pharmacy & Supply Chain", subProgram: "Rational Drug Use", indicator: "Average number of drugs per prescription", unit: "ratio", baseline: 3, target: 2 },

  // Human Resources
  { code: "HR_01", programArea: "Human Resources", subProgram: "Staffing", indicator: "Staff-to-patient ratio (inpatient)", unit: "ratio", baseline: 1, target: 1 },
  { code: "HR_02", programArea: "Human Resources", subProgram: "Capacity Building", indicator: "Staff trained in BEmONC", unit: "#", baseline: 4, target: 12 },
  { code: "HR_03", programArea: "Human Resources", subProgram: "Capacity Building", indicator: "Continuing professional development (CPD) sessions held", unit: "#", baseline: 6, target: 12 },

  // Health Information
  { code: "HIS_01", programArea: "Health Information", subProgram: "HMIS", indicator: "HMIS report completeness rate", unit: "%", baseline: 78, target: 95 },
  { code: "HIS_02", programArea: "Health Information", subProgram: "HMIS", indicator: "HMIS report timeliness rate", unit: "%", baseline: 65, target: 90 },
  { code: "HIS_03", programArea: "Health Information", subProgram: "Data Quality", indicator: "Data quality assessment (DQA) score", unit: "%", baseline: 60, target: 85 },

  // Community Health
  { code: "COMM_01", programArea: "Community Health", subProgram: "Outreach", indicator: "Health extension outreach sessions conducted", unit: "#", baseline: 24, target: 48 },
  { code: "COMM_02", programArea: "Community Health", subProgram: "Outreach", indicator: "Community health education sessions", unit: "#", baseline: 12, target: 36 },
  { code: "COMM_03", programArea: "Community Health", subProgram: "Referral", indicator: "Community referrals received at facility", unit: "#", baseline: 40, target: 80 },
];

// Generate sample monthly data with realistic patterns
export function generateSampleMonthlyData(): MonthlyEntry[] {
  const entries: MonthlyEntry[] = [];
  const currentMonth = 5; // simulate data up to June

  indicators.forEach((ind) => {
    const monthlyTarget = ind.target / 12;
    MONTHS.forEach((month, idx) => {
      if (idx < currentMonth) {
        // Generate somewhat realistic data with variance
        const variance = 0.6 + Math.random() * 0.8;
        const actual = Math.round(monthlyTarget * variance);
        entries.push({
          code: ind.code,
          month,
          actual,
          remarks: actual < monthlyTarget * 0.7 ? "Below target – needs intervention" : "",
        });
      } else {
        entries.push({ code: ind.code, month, actual: null, remarks: "" });
      }
    });
  });

  return entries;
}

export function getStatus(percent: number): "green" | "yellow" | "red" {
  if (percent >= 90) return "green";
  if (percent >= 70) return "yellow";
  return "red";
}

export function getActualYTD(code: string, monthlyData: MonthlyEntry[]): number {
  return monthlyData
    .filter((e) => e.code === code && e.actual !== null)
    .reduce((sum, e) => sum + (e.actual ?? 0), 0);
}

export function getProgramAreas(): string[] {
  return [...new Set(indicators.map((i) => i.programArea))];
}
