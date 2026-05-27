import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API router FIRST
  app.post("/api/gemini/suggest", async (req, res) => {
    const { kpiName, gapDescription, targetValue, actualValue, measure } = req.body;

    if (!kpiName) {
      return res.status(400).json({ error: "KPI Name is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyUnset = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "";

    if (isKeyUnset) {
      // Return high-quality, clinical-grade fallback templates when API key is missing
      const fallback = getFallbackSuggestion(kpiName, actualValue, targetValue, measure || "");
      return res.json({
        ...fallback,
        isDemo: true,
        note: "Note: Running in offline/demo mode. Connect a real Gemini API Key in 'Settings > Secrets' for live AI synthesis."
      });
    }

    try {
      // Lazy init the SDK
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const prompt = `You are a Senior Clinical Quality & Operations Director at Chefa Robit Hospital.
We have identified a performance gap in our hospital KPI:
- KPI Name: "${kpiName}"
- Performance Gap: "${gapDescription || `Target of ${targetValue}, but actual value is ${actualValue}`}"
- Value details: Actual of ${actualValue} vs Target of ${targetValue} (${measure})

Based on clinical guidelines (HSTQ, HAQ, or WHO standards), generate a professional, structured suggestion packet in JSON format.
Your response MUST be valid JSON only. Do not wrap in markdown code blocks like \`\`\`json.
Strictly return a JSON object with this exact structure:
{
  "rootCause": "A concise paragraph explaining the most likely clinical or operational root causes (e.g. documentation errors, supply bottlenecks, staffing shortages, scheduling issues). Use bullet points internally or clear items.",
  "correctiveAction": "A concise paragraph detailing a 3-step immediate action plan to resolve this gap (e.g. training, restocking, audit checks, roster realignment).",
  "suggestedResponsible": "The standard role responsible for this KPI (e.g. Clinical Director, Pharmacy Head, Ward Charge Nurse, Quality Coordinator). Only 1 short title.",
  "suggestedDeadline": "A suggested deadline date in YYYY-MM-DD format (recommend roughly 30 days from now)."
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const cleanText = response.text ? response.text.trim() : "";
      
      // Parse to ensure it is valid JSON
      try {
        const parsed = JSON.parse(cleanText);
        return res.json({
          ...parsed,
          isDemo: false
        });
      } catch (parseError) {
        console.error("Failed to parse Gemini JSON:", cleanText);
        // Fallback if parsing failed but returned content
        return res.json({
          rootCause: "A quality or resource constraint within the clinical departments at Chefa Robit Hospital, requiring deeper cross-departmental auditing.",
          correctiveAction: `1. Review documentation guidelines for ${kpiName}.\n2. Realign nurse staffing ratios with peak workloads.\n3. Conduct weekly progress feedback session with the Plan Coordinator.`,
          suggestedResponsible: "Department Head / Quality Team",
          suggestedDeadline: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
          isDemo: true,
          note: "Gemini output was generated but failed parsing. Using normalized format."
        });
      }

    } catch (err: any) {
      console.error("Gemini API call failed:", err);
      // Fail gracefully: Fall back to robust static templates
      const fallback = getFallbackSuggestion(kpiName, actualValue, targetValue, measure || "");
      return res.json({
        ...fallback,
        isDemo: true,
        note: `API error occurred: ${err.message}. Using built-in fallback suggestion.`
      });
    }
  });

  app.post("/api/gemini/analyze", async (req, res) => {
    const { indicators = [], monthlyData = [], selectedArea = "All", selectedEFY = "2018 EFY" } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyUnset = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "";

    if (isKeyUnset) {
      const fallback = getFallbackAnalysis(indicators, monthlyData, selectedArea);
      return res.json({
        ...fallback,
        isDemo: true,
        note: "Note: Running in offline/demo mode. Connect a real Gemini API Key in 'Settings > Secrets' for live AI synthesis."
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const slicedInds = indicators.slice(0, 6);
      const prompt = `You are a clinical coordinator and senior analytics researcher at Chefa Robit Hospital.
We want to run a strategic performance analysis and prediction modeling session for the program area: "${selectedArea}" during year: "${selectedEFY}".
Indicators under review:
${slicedInds.map((ind: any) => `- Name: "${ind.indicator}" (Code: ${ind.code}, Target: ${ind.target}, Baseline: ${ind.baseline})`).join("\n")}

Compute or simulate based on genuine clinical trends and Ethiopian health sector targets (HSTQ / HSTP guidelines):
1. A descriptive summary and 3-4 specific trends insights.
2. 3-4 prediction data models with confidence intervals (value forecast 0-100), staffing need score ("adequate", "warning_shortage", or "critical_shortage"), bed occupancy forecasts, and descriptive resource gap analyses.
3. 3-4 KPI evaluations details with achievement percentages, a status ("exceeded", "on_track", "off_track", or "critical"), and brief remedial guidance.
4. overallRecommendations of priority resolutions ("critical", "high", "medium") with specific timeline, estimated impact, and 3-4 clear step-by-step actions.

Strictly respond with valid JSON ONLY. No markdown wrappers. Return exactly a JSON object matching this schema:
{
  "trendAnalysis": {
    "summary": "Full summary text here",
    "insights": [
      { "title": "Insight heading", "description": "detailed insight description YTD actual details", "indicatorCode": "EPI_COV_01", "trendDirection": "increasing" }
    ]
  },
  "predictiveModeling": {
    "summary": "Full overview text here of workforce and bed utilization predictions",
    "predictions": [
      {
        "indicatorCode": "...",
        "indicatorName": "...",
        "forecastedMonths": [
          { "month": "Hamle", "value": 75, "confidenceIntervalLower": 70, "confidenceIntervalUpper": 80 },
          { "month": "Nehase", "value": 85, "confidenceIntervalLower": 78, "confidenceIntervalUpper": 92 },
          { "month": "Meskerem", "value": 90, "confidenceIntervalLower": 84, "confidenceIntervalUpper": 96 },
          { "month": "Tikimt", "value": 95, "confidenceIntervalLower": 88, "confidenceIntervalUpper": 99 }
        ],
        "staffingNeedScore": "warning_shortage",
        "bedOccupancyForecast": 78,
        "resourceGapAnalysis": "Details about staffing ratios, drug stockpiles and equipment deficiencies."
      }
    ]
  },
  "kpiEvaluation": {
    "summary": "Overall kpi performance metric review summary",
    "evaluations": [
      { "indicatorCode": "...", "name": "...", "baseline": 60, "target": 100, "currentActual": 85, "achievementPercentage": 85, "kpiStatus": "on_track", "remedialGuidance": "Direct corrective instruction text" }
    ]
  },
  "overallRecommendations": [
    {
      "title": "Actionable Strategic Initiative title",
      "priority": "high",
      "timeline": "3 weeks",
      "estimatedImpact": "Measurable operational impact",
      "actionSteps": ["Step A", "Step B", "Step C"]
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const cleanText = response.text ? response.text.trim() : "";
      try {
        const parsed = JSON.parse(cleanText);
        return res.json({
          ...parsed,
          isDemo: false
        });
      } catch (parseErr) {
        console.error("Failed parsing Gemini analyze JSON:", cleanText);
        throw parseErr;
      }
    } catch (err: any) {
      console.error("Failed running Gemini analysis:", err);
      const fallback = getFallbackAnalysis(indicators, monthlyData, selectedArea);
      return res.json({
        ...fallback,
        isDemo: true,
        note: `AI call failed (${err.message}). Loaded high-fidelity offline analytical fallback.`
      });
    }
  });

  // NEW: API route for AI-assisted semantic mapping of uploaded columns/indicators
  app.post("/api/gemini/automap", async (req, res) => {
    const { rawEntries = [], officialIndicators = [] } = req.body;

    if (!rawEntries.length) {
      return res.status(400).json({ error: "No raw entries provided for mapping." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyUnset = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "";

    if (isKeyUnset) {
      const fallback = getFallbackAutomap(rawEntries, officialIndicators);
      return res.json({
        mappings: fallback,
        isDemo: true,
        note: "Note: Connected to offline heuristic mapper. Set API key in Settings > Secrets for full Gemini deep semantic parsing."
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const slicedOfficial = officialIndicators.slice(0, 50); // limit to protect payload
      const slicedRaw = rawEntries.slice(0, 30);

      const prompt = `You are a clinical database mapping agent at Black Lion Hospital.
We have imported a monthly report with raw, non-standard names or labels. We need to map them to our official 270 clinical indicator codes.
Official System Indicators (Code and Description list):
${slicedOfficial.map((o: any) => `- Code: "${o.code}", Name: "${o.indicator}"`).join("\n")}

Raw Imported Labels:
${slicedRaw.map((r: any) => `- Label: "${r.rawLabel}", Value: ${r.value}`).join("\n")}

By matching based on clinical synonyms, abbreviations, and context, map each raw label to the single most relevant official indicator's code.
If there is no logical clinical connection whatsoever, map the code as empty string "" and confidence as 0.

Strictly respond with valid JSON ONLY. No markdown wrappers. Return exactly a JSON object matching this schema:
{
  "mappings": [
    {
      "rawLabel": "Name of raw label exactly match the prompt list",
      "matchedCode": "Official indicator code",
      "confidenceScore": 0.85, // 0.0 to 1.0 based on clinical semantic match
      "matchReason": "Brief explanation of synonym or clinical mapping rationale"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const cleanText = response.text ? response.text.trim() : "";
      try {
        const parsed = JSON.parse(cleanText);
        return res.json({
          mappings: parsed.mappings || [],
          isDemo: false
        });
      } catch (parseErr) {
        console.error("Failed parsing Gemini automap JSON:", cleanText);
        throw parseErr;
      }
    } catch (err: any) {
      console.error("Failed running Gemini automap:", err);
      const fallback = getFallbackAutomap(rawEntries, officialIndicators);
      return res.json({
        mappings: fallback,
        isDemo: true,
        note: `AI match failed (${err.message}). Reverted to heuristic semantic mapping.`
      });
    }
  });

  // NEW: API route for AI-powered monthly actuals direct generation and forecasting
  app.post("/api/gemini/sync-generate", async (req, res) => {
    const { month = "Sene", programArea = "All", indicatorsList = [] } = req.body;

    if (!indicatorsList.length) {
      return res.status(400).json({ error: "Official indicators list required to generate values." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyUnset = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "";

    if (isKeyUnset) {
      const fallback = getFallbackSyncGenerate(month, programArea, indicatorsList);
      return res.json({
        entries: fallback,
        isDemo: true,
        note: "Note: Running in simulation mode. Set Gemini API key for true predictive clinical intelligence."
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const filteredInds = programArea === "All" 
        ? indicatorsList.slice(0, 15) 
        : indicatorsList.filter((i: any) => i.programArea === programArea).slice(0, 15);

      const prompt = `You are a Senior Hospital Administrator specialized in Ethiopian Health Information Systems (DHIS2).
We are auto-generating real clinical monthly indicators and actuals for the month: "${month}" and program area: "${programArea}".
Rather than filling cells manually, we want Gemini to construct realistic performance actual values.
The values should represent realistic Ethiopian Hospital caseload distributions, reflecting seasonality (e.g., malaria in rainy months, outpatient volume surges).

Indicators we want to fill:
${filteredInds.map((i: any) => `- Code: "${i.code}", Title: "${i.indicator}", Unit: "${i.unit}", Target: ${i.target}, Baseline: ${i.baseline}`).join("\n")}

Respond strictly in valid JSON format ONLY. Do not wrap in markdown \`\`\`json.
Return exactly a JSON object matching this schema:
{
  "entries": [
    {
      "code": "indicator code",
      "actual": 125, // realistic integer value compared to the annual target or baseline
      "remarks": "AI-generated: Seasonality explanation, trend rationale, or clinical observation in 10-15 words"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const cleanText = response.text ? response.text.trim() : "";
      try {
        const parsed = JSON.parse(cleanText);
        return res.json({
          entries: parsed.entries || [],
          isDemo: false
        });
      } catch (parseErr) {
        console.error("Failed parsing sync-generate JSON:", cleanText);
        throw parseErr;
      }
    } catch (err: any) {
      console.error("Failed running Gemini sync-generate:", err);
      const fallback = getFallbackSyncGenerate(month, programArea, indicatorsList);
      return res.json({
        entries: fallback,
        isDemo: true,
        note: `AI simulation failed (${err.message}). Loaded high-fidelity offline synthesis.`
      });
    }
  });

  // Serve static files / Vite dev server middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hospital KPI Server running on http://localhost:${PORT}`);
  });
}

// Highly relevant, hospital-specific fallback generator for different KPIs
function getFallbackSuggestion(kpiName: string, actual: number, target: number, measure: string) {
  const nameLower = kpiName.toLowerCase();
  
  if (nameLower.includes("audit")) {
    return {
      rootCause: "Inadequate training on standardized electronic medical records (EMR) inputs, coupled with delay in peer file review loops.",
      correctiveAction: "1. Mandate a daily 15-minute chart completion review.\n2. Dedicate a Lead Medical Record Staff to audit random discharges.\n3. Provide immediate dashboard lookup for critical metrics.",
      suggestedResponsible: "Medical Records Coordinator",
      suggestedDeadline: "2025-12-30"
    };
  } else if (nameLower.includes("occupancy")) {
    return {
      rootCause: "Uneven patient stream distribution, bottlenecks in triage discharge clearance, and seasonal reduction in elective case rates.",
      correctiveAction: "1. Optimize discharge checklists to be filled before 11:00 AM.\n2. Reallocate floating nurses to high-demand active wards.\n3. Install coordinate board in emergency to preview bed statuses.",
      suggestedResponsible: "Ward Charge Nurse",
      suggestedDeadline: "2025-12-15"
    };
  } else if (nameLower.includes("mortality")) {
    return {
      rootCause: "Delay in initiating septic-shock protocols at emergency response, and lack of specialized ICU beds during peak weekend nights.",
      correctiveAction: "1. Implement immediate sepsis response triage alerts.\n2. Revise weekend critical-care physician on-call rosters.\n3. Carry out audit reviews for every emergency mortality case.",
      suggestedResponsible: "Emergency Department Head",
      suggestedDeadline: "2025-12-25"
    };
  } else if (nameLower.includes("satisfaction")) {
    return {
      rootCause: "Long outpatient waiting times at pharmacy and cashier tables, accompanied by poor communication regarding triage delay statuses.",
      correctiveAction: "1. Launch a feedback collection terminal at prime exit bays.\n2. Implement wait-time announcement screens next to OPD seats.\n3. Train receptionist staff on active listening and patient empathy.",
      suggestedResponsible: "Patient Experience Liaison",
      suggestedDeadline: "2026-01-10"
    };
  } else if (nameLower.includes("stockout") || nameLower.includes("oxygen")) {
    return {
      rootCause: "Supply chain pipeline delays, lack of warning thresholds on cylinder storage levels, and delayed procurement request confirmations.",
      correctiveAction: "1. Install safety red-line levels on oxygen manifolds.\n2. Digitize stock re-order points with instant sms-emails to pharmacy head.\n3. Standardize safety stock reserves with emergency gas supplier.",
      suggestedResponsible: "Logistics & Logistics Coordinator",
      suggestedDeadline: "2025-12-10"
    };
  } else if (nameLower.includes("waiting")) {
    return {
      rootCause: "Congested peak outpatient registration schedules (9:00 AM to 11:30 AM) and slow paper chart retrieval from central archives.",
      correctiveAction: "1. Stagger online and manual bookings into predefined morning blocks.\n2. Digitize patient registration index for immediate retrieval.\n3. Deploy additional triage nurse desk during rush peak windows.",
      suggestedResponsible: "OPD Operations Lead",
      suggestedDeadline: "2025-12-20"
    };
  } else {
    return {
      rootCause: `Resource mismatch, data input delay, and lack of real-time monitoring on standard clinical practices for: ${kpiName}.`,
      correctiveAction: `1. Re-evaluate measurement accuracy against targets.\n2. Hold a cross-departmental alignment session with relevant ward heads.\n3. Implement a weekly audit checklist reviewed by the Plan Coordinator.`,
      suggestedResponsible: "Quality Improvement Director",
      suggestedDeadline: "2025-12-31"
    };
  }
}

function getFallbackAnalysis(indicators: any[], monthlyData: any[], area: string) {
  const filtered = !indicators || indicators.length === 0 
    ? [
        { code: "MCH_ANC_01", indicator: "Antenatal Care 4th Visit Coverage", programArea: "Maternal & Child Health", target: 500, baseline: 350, unit: "%" },
        { code: "EPI_COV_01", indicator: "Penta 3 Vaccination Coverage", programArea: "EPI", target: 600, baseline: 420, unit: "%" },
        { code: "TB_CURE_02", indicator: "Tuberculosis Treatment Cure Rate", programArea: "Tuberculosis", target: 95, baseline: 80, unit: "%" }
      ]
    : (area === "All" || area === "all" ? indicators : indicators.filter((i: any) => i.programArea === area));

  const ETHIOPIAN_MONTHS = ["Hamle", "Nehase", "Meskerem", "Tikimt"];

  const evaluations = filtered.slice(0, 6).map((ind: any) => {
    let actual = 0;
    if (Array.isArray(monthlyData)) {
      monthlyData.forEach((e: any) => {
        if (e.code === ind.code && e.actual != null) {
          actual += e.actual;
        }
      });
    }
    // ensure random but deterministic actual for rich experience is simulated if actuals are 0
    if (actual === 0) {
      actual = Math.round((ind.target || 100) * 0.78);
    }
    const target = ind.target > 0 ? ind.target : 100;
    const pct = Math.round((actual / target) * 100);
    const status = pct >= 95 ? "exceeded" : pct >= 90 ? "on_track" : pct >= 70 ? "off_track" : "critical";
    return {
      indicatorCode: ind.code,
      name: ind.indicator,
      baseline: ind.baseline || 0,
      target,
      currentActual: actual,
      achievementPercentage: pct,
      kpiStatus: status as any,
      remedialGuidance: status === "critical"
        ? "Critical deficit observed. Instigate rapid response task force and reallocate emergency commodities immediately."
        : status === "off_track"
        ? "Under-performance detected. Plan bi-weekly operational review and update clinical flow maps."
        : "Operational standards satisfied. Document workflow efficiencies for hospital-wide replication."
    };
  });

  const onTrack = evaluations.filter((e: any) => e.kpiStatus === "on_track" || e.kpiStatus === "exceeded").length;
  const offTrack = evaluations.filter((e: any) => e.kpiStatus === "critical" || e.kpiStatus === "off_track").length;

  return {
    trendAnalysis: {
      summary: `Diagnostic snapshot shows ${onTrack} metrics on target and ${offTrack} under-performing metrics in the ${area} service sector.`,
      insights: filtered.slice(0, 4).map((ind: any, i: number) => {
        const dirs = ["increasing", "stable", "decreasing", "fluctuating"];
        return {
          title: ind.indicator,
          indicatorCode: ind.code,
          trendDirection: dirs[i % 4] as any,
          description: `YTD assessment shows a ${dirs[i % 4]} path. Target values of ${ind.target} are currently met at a standard capacity limit. Quality metrics necessitate monthly verification.`
        };
      })
    },
    predictiveModeling: {
      summary: "Patient admission forecasts predict a 12% rise over the next Ethiopian quarter. Bed allocation and staff scheduling need strict alignment.",
      predictions: filtered.slice(0, 4).map((ind: any, i: number) => {
        return {
          indicatorCode: ind.code,
          indicatorName: ind.indicator,
          forecastedMonths: ETHIOPIAN_MONTHS.map((m, idx) => {
            const baseVal = 70 + (i * 4) + (idx * 5);
            const val = Math.min(99, baseVal);
            return {
              month: m,
              value: val,
              confidenceIntervalLower: Math.max(0, val - 7),
              confidenceIntervalUpper: Math.min(100, val + 6)
            };
          }),
          staffingNeedScore: (["adequate", "warning_shortage", "critical_shortage"] as const)[i % 3],
          bedOccupancyForecast: 65 + (i * 6),
          resourceGapAnalysis: `Staff deployment ratios indicate a latent deficit during shift transitions. Equipment maintenance schedules require audit checks.`
        };
      })
    },
    kpiEvaluation: {
      summary: `Historical performance reveals mixed execution success across key program thresholds. Overall progress is at 84% target realization.`,
      evaluations
    },
    overallRecommendations: [
      {
        title: "Improve Health Information Recording & EMR Compliance",
        priority: "high" as const,
        timeline: "2 weeks",
        estimatedImpact: "Guarantees 100% data fidelity on DHIS2 synchronizations.",
        actionSteps: [
          "Establish shift-end data check protocols across inpatient departments.",
          "Hold automated feedback rounds on missing indicator entries.",
          "Conduct direct on-job EMR navigation retraining for ward administrators."
        ]
      },
      {
        title: "Realign Clinical Roster Policies",
        priority: offTrack > 1 ? "critical" : ("medium" as const),
        timeline: "1 month",
        estimatedImpact: "Refines worker coverage indices during critical peak surges.",
        actionSteps: [
          "Audit duty logs against patient flow curves for emergency service rooms.",
          "Redeploy auxiliary nursing staff during morning peak hours.",
          "Activate a float pool roster for acute ward coverage."
        ]
      }
    ]
  };
}

function getFallbackAutomap(rawEntries: any[], officialIndicators: any[]) {
  return rawEntries.map((raw: any) => {
    const rawLabel = String(raw.rawLabel || "").trim();
    const matches = officialIndicators.find((ind: any) => 
      ind.indicator.toLowerCase().includes(rawLabel.toLowerCase()) || 
      rawLabel.toLowerCase().includes(ind.indicator.toLowerCase()) ||
      ind.code.toLowerCase() === rawLabel.toLowerCase()
    );
    return {
      rawLabel,
      matchedCode: matches ? matches.code : "",
      confidenceScore: matches ? 0.92 : 0,
      matchReason: matches ? `Matched semantically to code ${matches.code}` : "Clinical semantic confidence low. Review needed."
    };
  });
}

function getFallbackSyncGenerate(month: string, programArea: string, indicatorsList: any[]) {
  const filtered = programArea === "All"
    ? indicatorsList.slice(0, 15)
    : indicatorsList.filter((i: any) => i.programArea === programArea).slice(0, 15);

  return filtered.map((ind: any, idx: number) => {
    const target = ind.target || 100;
    const baseline = ind.baseline || 60;
    const spread = (idx % 4) * 5;
    const actual = Math.round(baseline + ((target - baseline) * 0.75) + spread);
    return {
      code: ind.code,
      actual,
      remarks: `Synced via offline predictive heuristics for ${month}. Trend aligns with baseline targets.`
    };
  });
}

startServer();
