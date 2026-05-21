import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Warning] GEMINI_API_KEY is not defined. Falling back to mock analytics.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'plan-compass-app',
      }
    }
  });
};

// Expose a health API endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Expose AI Analysis endpoint
app.post("/api/ai/analyze", async (req, res) => {
  try {
    const { indicators, monthlyData, profile, requestType } = req.body;

    if (!indicators || !monthlyData || !profile) {
      return res.status(400).json({ error: "Missing required parameters: indicators, monthlyData, and profile are required." });
    }

    const ai = getGeminiClient();

    // If API key is not configured, send beautiful mock responses so the user can still test the interface flawlessly
    if (!ai) {
      const mockResult = generateMockAiData(indicators, monthlyData, profile);
      return res.json({
        success: true,
        source: "mock_engine",
        data: mockResult
      });
    }

    // Build targeted detailed prompt for Gemini
    const systemPrompt = `You are Plan Compass's senior health systems data scientist and medical performance evaluator.
Your goal is to perform:
1. Trend Analysis: Identify patient inflow trends, clinical resource utilization, vaccine campaigns, disease outbreaks or diagnostic shifts based on historical actuals.
2. Predictive Modeling: Generate monthly forecasts for the next 4 months. Predict bed occupancy bottlenecks (expressed as percentage), staffing adequacy, and critical medical supply gap evaluation.
3. KPI & Strategic Evaluation: Measure current achievements against baseline (2015) and target (2016) values, setting clinical status and remedial recovery instructions.
4. Actionable Strategic Recommendations: Formulate a list of high-priority clinical directives, assigning clear timelines, priority tiers, and required inputs.

Analyze the data with extreme mathematical consistency. Do not hallucinate numbers from nowhere; respect the baselines and targets of the indicators. Calculate real aggregate rates where possible.`;

    const userPrompt = `Perform analysis for the department: "${profile.department}" in facility: "${profile.facility}", located in "${profile.region}".
    
Indicators:
${JSON.stringify(indicators, null, 2)}

Historical Monthly Reporting Entries:
${JSON.stringify(monthlyData, null, 2)}

Active User Profile Context:
${JSON.stringify(profile, null, 2)}

Please provide the output directly structured into JSON matching the requested schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1, // low temperature for analytical accuracy
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["trendAnalysis", "predictiveModeling", "kpiEvaluation", "overallRecommendations"],
          properties: {
            trendAnalysis: {
              type: Type.OBJECT,
              required: ["summary", "insights"],
              properties: {
                summary: { type: Type.STRING, description: "A high-level executive summary of historical data patterns, patient inflow fluctuations, and anomalies." },
                insights: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["title", "description", "indicatorCode", "trendDirection"],
                    properties: {
                      title: { type: Type.STRING, description: "Short descriptive title of the insight." },
                      description: { type: Type.STRING, description: "Detailed clinical description and possible structural causes." },
                      indicatorCode: { type: Type.STRING, description: "Relevant indicator code or 'ALL'." },
                      trendDirection: { type: Type.STRING, enum: ["increasing", "decreasing", "stable", "fluctuating"] }
                    }
                  }
                }
              }
            },
            predictiveModeling: {
              type: Type.OBJECT,
              required: ["summary", "predictions"],
              properties: {
                summary: { type: Type.STRING, description: "Executive summary explaining forecasted workload, staffing risks, and resource gaps for the upcoming months." },
                predictions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["indicatorCode", "indicatorName", "forecastedMonths", "staffingNeedScore", "bedOccupancyForecast", "resourceGapAnalysis"],
                    properties: {
                      indicatorCode: { type: Type.STRING, description: "Relevant indicator code" },
                      indicatorName: { type: Type.STRING, description: "Human descriptive name of the indicator" },
                      forecastedMonths: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          required: ["month", "value", "confidenceIntervalLower", "confidenceIntervalUpper"],
                          properties: {
                            month: { type: Type.STRING, description: "The name of the forecasted month" },
                            value: { type: Type.NUMBER, description: "The projected value for this month based on trend modeling" },
                            confidenceIntervalLower: { type: Type.NUMBER },
                            confidenceIntervalUpper: { type: Type.NUMBER }
                          }
                        }
                      },
                      staffingNeedScore: { type: Type.STRING, enum: ["adequate", "warning_shortage", "critical_shortage"] },
                      bedOccupancyForecast: { type: Type.NUMBER, description: "Predicted bed occupancy percentage for the department" },
                      resourceGapAnalysis: { type: Type.STRING, description: "Details of predicted equipment, bed, or pharmaceutical shortfalls" }
                    }
                  }
                }
              }
            },
            kpiEvaluation: {
              type: Type.OBJECT,
              required: ["summary", "evaluations"],
              properties: {
                summary: { type: Type.STRING, description: "Comparative overview of performance achievements relative to baselines and targets." },
                evaluations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ["indicatorCode", "name", "baseline", "target", "currentActual", "achievementPercentage", "kpiStatus", "remedialGuidance"],
                    properties: {
                      indicatorCode: { type: Type.STRING },
                      name: { type: Type.STRING },
                      baseline: { type: Type.NUMBER },
                      target: { type: Type.NUMBER },
                      currentActual: { type: Type.NUMBER },
                      achievementPercentage: { type: Type.NUMBER, description: "Calculated progress score relative to target" },
                      kpiStatus: { type: Type.STRING, enum: ["exceeded", "on_track", "off_track", "critical"] },
                      remedialGuidance: { type: Type.STRING, description: "Actionable strategic directive to rescue performance" }
                    }
                  }
                }
              }
            },
            overallRecommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["title", "actionSteps", "priority", "timeline", "estimatedImpact"],
                properties: {
                  title: { type: Type.STRING, description: "Core recommendation title" },
                  actionSteps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  priority: { type: Type.STRING, enum: ["critical", "high", "medium"] },
                  timeline: { type: Type.STRING, description: "Expected timeline" },
                  estimatedImpact: { type: Type.STRING, description: "Description of potential performance uplift" }
                }
              }
            }
          }
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    return res.json({
      success: true,
      source: "gemini_copilot",
      data: parsedData
    });

  } catch (error: any) {
    console.error("AI Analysis error:", error);
    res.status(500).json({ error: error?.message || "Internal server error occurred during AI analysis." });
  }
});

// Mock generator in case GEMINI_API_KEY is not configured
function generateMockAiData(indicators: any[], monthlyData: any[], profile: any) {
  const deptIndicators = indicators.filter(ind => profile.department === "All" || ind.department === profile.department);
  const activeIndicators = deptIndicators.length > 0 ? deptIndicators : indicators.slice(0, 3);
  
  // Predict upcoming Ethiopian months based on what is reported
  const mockForecastingMonths = ["Tikimt", "Hidar", "Tahsas", "Tirr"];

  const trendInsights = activeIndicators.map((ind, idx) => {
    const directions = ["increasing", "decreasing", "stable", "fluctuating"];
    const direction = directions[idx % directions.length];
    
    let cause = "supply chain constraints and seasonal access factors.";
    if (ind.code?.includes("ANC")) cause = "community antenatal awareness camp registrations.";
    if (ind.code?.includes("SBA")) cause = "seasonal road accessibility factors.";
    if (ind.code?.includes("TB")) cause = "proactive screening operations.";

    return {
      title: `${ind.name} ${direction === "increasing" ? "Uptrend" : direction === "decreasing" ? "Decline" : "Stabilization"} Detected`,
      description: `Analysis shows a performance rate shifting towards a ${direction} pattern. This is primarily attributed to ${cause}`,
      indicatorCode: ind.code,
      trendDirection: direction
    };
  });

  const predictions = activeIndicators.map((ind, idx) => {
    const baseline = ind.baseline2015 || 50;
    const target = ind.target2016 || 80;
    const slope = (target - baseline) * 0.08;

    const forecastedMonths = mockForecastingMonths.map((m, mIdx) => {
      const scaleValue = Math.round(baseline + (slope * (mIdx + 4)) + (Math.sin(mIdx + idx) * 3));
      const value = Math.max(1, Math.min(100, scaleValue));
      return {
        month: m,
        value,
        confidenceIntervalLower: Math.max(0, value - 5),
        confidenceIntervalUpper: Math.min(100, value + 6)
      };
    });

    return {
      indicatorCode: ind.code,
      indicatorName: ind.name,
      forecastedMonths,
      staffingNeedScore: "adequate",
      bedOccupancyForecast: Math.min(95, Math.max(40, 65 + (idx * 9))),
      resourceGapAnalysis: "Standard resource availability maintained for this period."
    };
  });

  const evaluations = activeIndicators.map((ind) => {
    const actualReports = monthlyData.filter((e: any) => e.code === ind.code && e.actual !== null);
    const sum = actualReports.reduce((acc: number, curr: any) => acc + (curr.actual || 0), 0);
    const currentActual = actualReports.length > 0 ? Math.round(sum / actualReports.length) : 75;
    
    const target = ind.target2016 || 100;
    const pct = Math.round((currentActual / target) * 100);
    
    let kpiStatus = "on_track";
    if (pct < 60) {
      kpiStatus = "critical";
    } else if (pct < 85) {
      kpiStatus = "off_track";
    } else if (pct >= 100) {
      kpiStatus = "exceeded";
    }

    return {
      indicatorCode: ind.code,
      name: ind.name,
      baseline: ind.baseline2015 || 0,
      target,
      currentActual,
      achievementPercentage: pct,
      kpiStatus,
      remedialGuidance: "Continue monitoring and supporting this indicator."
    };
  });

  return {
    trendAnalysis: {
      summary: `Analysis for "${profile.department}" department shows normal seasonal trends with stable data quality.`,
      insights: trendInsights
    },
    predictiveModeling: {
      summary: "Forecasting indicates moderate workload with stable staffing requirements.",
      predictions
    },
    kpiEvaluation: {
      summary: "Most core indicators are progressing towards targets.",
      evaluations
    },
    overallRecommendations: [
      {
        title: "Maintain Current Operations",
        actionSteps: [
          "Continue routine monitoring",
          "Document best practices"
        ],
        priority: "medium",
        timeline: "Ongoing",
        estimatedImpact: "Sustained performance levels"
      }
    ]
  };
}

// Vite middleware development setup or serving production built static files
const startServer = async () => {
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
    console.log(`[Plan Compass Engine] Server running on port ${PORT}`);
  });
};

startServer().catch((e) => {
  console.error("Failed to boot server:", e);
});
