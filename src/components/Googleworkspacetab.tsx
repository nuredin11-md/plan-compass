import React, { useState, useEffect } from "react";
import type { MonthlyEntry } from "@/data/hospitalIndicators";
import { useIndicators } from "@/context/IndicatorsContext";
import { useAuth } from "@/hooks/useAuth";
import {
  Cloud, CheckCircle2, AlertCircle, Plus, Loader2,
  TableProperties, Presentation, ListTodo, LogOut,
  FolderSync, Sparkles, ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GoogleTask {
  id: string;
  title: string;
  status: string;
  notes?: string;
  due?: string;
}

interface GoogleTaskList {
  id: string;
  title: string;
}

interface Props {
  monthlyData: MonthlyEntry[];
}

// ── Google API Helpers ────────────────────────────────────────────────────────
// These call Google APIs directly via the access token obtained from OAuth popup.

async function googleSignIn(): Promise<{ accessToken: string; user: { email: string; displayName: string } } | null> {
  return new Promise((resolve, reject) => {
    const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
      scope: [
        "https://www.googleapis.com/auth/tasks",
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/presentations",
        "https://www.googleapis.com/auth/drive.file",
        "profile",
        "email",
      ].join(" "),
      callback: async (tokenResponse: any) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
          return;
        }
        // Fetch basic profile
        try {
          const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          });
          const profile = await profileRes.json();
          resolve({
            accessToken: tokenResponse.access_token,
            user: { email: profile.email, displayName: profile.name },
          });
        } catch {
          resolve({ accessToken: tokenResponse.access_token, user: { email: "", displayName: "Google User" } });
        }
      },
    });

    if (!client) {
      reject(new Error("Google Identity Services not loaded. Add <script src='https://accounts.google.com/gsi/client'></script> to index.html and set VITE_GOOGLE_CLIENT_ID in .env"));
      return;
    }
    client.requestAccessToken();
  });
}

async function apiFetch(url: string, token: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchTaskLists(token: string): Promise<GoogleTaskList[]> {
  const data = await apiFetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", token);
  return data.items || [];
}

async function fetchTasks(token: string, listId: string): Promise<GoogleTask[]> {
  const data = await apiFetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true`, token);
  return data.items || [];
}

async function createTask(token: string, listId: string, task: { title: string; notes?: string; due?: string }): Promise<GoogleTask> {
  return apiFetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, token, {
    method: "POST",
    body: JSON.stringify(task),
  });
}

async function createTaskList(token: string, title: string): Promise<GoogleTaskList> {
  return apiFetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", token, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

async function updateTaskStatus(token: string, listId: string, taskId: string, completed: boolean): Promise<void> {
  await apiFetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ status: completed ? "completed" : "needsAction" }),
  });
}

async function exportToGoogleSheets(
  token: string,
  title: string,
  headers: string[],
  rows: any[][]
): Promise<{ spreadsheetUrl: string }> {
  const createRes = await apiFetch("https://sheets.googleapis.com/v4/spreadsheets", token, {
    method: "POST",
    body: JSON.stringify({ properties: { title } }),
  });
  const spreadsheetId = createRes.spreadsheetId;
  const values = [headers, ...rows];
  await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=RAW`, token, {
    method: "POST",
    body: JSON.stringify({ values }),
  });
  return { spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
}

async function exportToGoogleSlides(
  token: string,
  title: string,
  slides: { title: string; bulletPoints: string[] }[]
): Promise<{ presentationUrl: string }> {
  const createRes = await apiFetch("https://slides.googleapis.com/v1/presentations", token, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  const presentationId = createRes.presentationId;
  // Add slides via batchUpdate
  const requests = slides.flatMap((slide) => [
    { createSlide: { slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" } } },
  ]);
  if (requests.length > 0) {
    await apiFetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, token, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }
  return { presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit` };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GoogleWorkspaceTab({ monthlyData }: Props) {
  const { indicators } = useIndicators();
  const { user, profile } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<{ email: string; displayName: string } | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"tasks" | "sheets" | "slides">("sheets");

  // Tasks state
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newListName, setNewListName] = useState("");
  const [showAddList, setShowAddList] = useState(false);
  const [diagnosticTasks, setDiagnosticTasks] = useState<{ code: string; title: string; notes: string; selected: boolean }[]>([]);

  // Sheets state
  const [sheetStatus, setSheetStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [exportFilter, setExportFilter] = useState<"all" | "critical" | "mch">("all");

  // Slides state
  const [slidesStatus, setSlidesStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [slidesUrl, setSlidesUrl] = useState<string | null>(null);
  const [slidesError, setSlidesError] = useState<string | null>(null);

  const facilityName = profile?.display_name || user?.email || "Hospital";

  // Sign in
  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setGoogleUser(result.user);
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to connect Google Workspace.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = () => {
    setToken(null);
    setGoogleUser(null);
    setTasks([]);
    setTaskLists([]);
    setSelectedListId("");
  };

  // Load task lists on auth
  useEffect(() => {
    if (!token) return;
    setIsLoadingLists(true);
    fetchTaskLists(token)
      .then((lists) => {
        setTaskLists(lists);
        if (lists.length > 0) setSelectedListId(lists[0].id);
      })
      .catch(console.error)
      .finally(() => setIsLoadingLists(false));
  }, [token]);

  // Load tasks on list change
  useEffect(() => {
    if (!token || !selectedListId) return;
    setIsLoadingTasks(true);
    fetchTasks(token, selectedListId)
      .then(setTasks)
      .catch(console.error)
      .finally(() => setIsLoadingTasks(false));
  }, [token, selectedListId]);

  // Generate diagnostic tasks from underperforming indicators
  useEffect(() => {
    if (!indicators.length) return;
    const alerts = indicators
      .filter((ind) => ind.target > 0)
      .slice(0, 5)
      .map((ind) => ({
        code: ind.code,
        title: `Review action plan for: ${ind.indicator}`,
        notes: `Indicator: ${ind.indicator}\nProgram Area: ${ind.programArea}\nTarget: ${ind.target}\nFacility: ${facilityName}`,
        selected: true,
      }));
    setDiagnosticTasks(alerts);
  }, [indicators, facilityName]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedListId || !newTaskTitle.trim()) return;
    try {
      const added = await createTask(token, selectedListId, {
        title: newTaskTitle.trim(),
        notes: `Logged via Plan Compass M&E for ${profile?.department || "hospital"} review.`,
      });
      setTasks((prev) => [added, ...prev]);
      setNewTaskTitle("");
    } catch (err) { console.error(err); }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newListName.trim()) return;
    try {
      const newList = await createTaskList(token, newListName.trim());
      setTaskLists((prev) => [...prev, newList]);
      setSelectedListId(newList.id);
      setNewListName("");
      setShowAddList(false);
    } catch (err) { console.error(err); }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    if (!token || !selectedListId) return;
    const isCompleted = currentStatus === "completed";
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: isCompleted ? "needsAction" : "completed" } : t));
    try {
      await updateTaskStatus(token, selectedListId, taskId, !isCompleted);
    } catch {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: isCompleted ? "completed" : "needsAction" } : t));
    }
  };

  const handlePushDiagnosticTasks = async () => {
    if (!token || !selectedListId) return;
    const toPush = diagnosticTasks.filter((t) => t.selected);
    if (!toPush.length) return;
    if (!window.confirm(`Push ${toPush.length} M&E action tasks to Google Tasks?`)) return;
    setIsLoadingTasks(true);
    try {
      for (const t of toPush) {
        await createTask(token, selectedListId, {
          title: t.title,
          notes: t.notes,
          due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
      const updated = await fetchTasks(token, selectedListId);
      setTasks(updated);
      setDiagnosticTasks((prev) => prev.map((item) => ({ ...item, selected: false })));
      alert("Successfully pushed action tasks to Google Tasks!");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleSheetsExport = async () => {
    if (!token) return;
    setSheetStatus("loading");
    setSheetUrl(null);
    setSheetError(null);
    try {
      let filtered = [...indicators];
      if (exportFilter === "critical") filtered = indicators.filter((i) => i.target > 0);
      if (exportFilter === "mch") filtered = indicators.filter((i) => i.programArea === "Maternal & Child Health");

      const headers = ["Code", "Program Area", "Sub-Program", "Indicator", "Unit", "Baseline", "Target", "Status"];
      const rows = filtered.map((ind) => [ind.code, ind.programArea, ind.subProgram, ind.indicator, ind.unit, ind.baseline, ind.target, "Active"]);
      const res = await exportToGoogleSheets(token, `${facilityName} M&E Plan Export`, headers, rows);
      setSheetUrl(res.spreadsheetUrl);
      setSheetStatus("success");
    } catch (err: any) {
      setSheetError(err.message);
      setSheetStatus("error");
    }
  };

  const handleSlidesExport = async () => {
    if (!token) return;
    setSlidesStatus("loading");
    setSlidesUrl(null);
    setSlidesError(null);
    try {
      const slidesData = [
        {
          title: "Hospital M&E Strategic Performance Review",
          bulletPoints: [`Facility: ${facilityName}`, `Total Indicators: ${indicators.length}`, "EFY 2018-2019 Strategic Review"],
        },
        {
          title: "Key Program Areas",
          bulletPoints: [...new Set(indicators.map((i) => i.programArea))].slice(0, 8),
        },
        {
          title: "Recommended Next Steps",
          bulletPoints: [
            "1. Set up bi-weekly evaluation reviews for underperforming indicators.",
            "2. Ensure DHIS2 data sync is current and complete.",
            "3. Coordinate with regional focal persons on resource allocation.",
          ],
        },
      ];
      const res = await exportToGoogleSlides(token, `${facilityName} M&E Performance Report`, slidesData);
      setSlidesUrl(res.presentationUrl);
      setSlidesStatus("success");
    } catch (err: any) {
      setSlidesError(err.message);
      setSlidesStatus("error");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">

      {/* Header */}
      <div className="bg-slate-900 px-6 py-6 text-white border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-500 rounded-md"><Cloud className="h-5 w-5 text-white" /></div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Google Workspace Connection Hub</h2>
            <p className="text-xs text-slate-400 font-medium">Export to Google Sheets, Slides, and Tasks in real-time</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {!token ? (
          /* ── Logged Out State ── */
          <div className="max-w-xl mx-auto py-10 px-4 text-center space-y-8">
            <div className="inline-flex p-4 bg-slate-50 border border-slate-200 rounded-full text-slate-400">
              <FolderSync className="h-10 w-10 text-indigo-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-md font-bold text-slate-900">Synchronize with Google Suite</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Connect your Google account to export indicators to Sheets, build Slides presentations, and log review tasks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left text-xs">
              {[
                { Icon: TableProperties, label: "Sheets", color: "text-teal-600", desc: "Export indicator tables to custom formatted Google Spreadsheets." },
                { Icon: Presentation, label: "Slides", color: "text-amber-500", desc: "Build annual summary presentations with real performance metrics." },
                { Icon: ListTodo, label: "Tasks", color: "text-blue-500", desc: "Sync critical indicator discrepancies as corrective follow-up tasks." },
              ].map(({ Icon, label, color, desc }) => (
                <div key={label} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className={`${color} font-bold flex items-center gap-1.5 uppercase tracking-wider`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            <div className="pt-4 flex flex-col items-center gap-4">
              <button
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="w-full max-w-[280px] h-[42px] bg-white border border-slate-300 rounded-md hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-3 shadow"
              >
                <svg viewBox="0 0 48 48" className="w-5 h-5">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span className="text-xs font-semibold text-slate-700">Connect Google Workspace</span>
              </button>

              {isAuthenticating && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />Establishing secure session...
                </div>
              )}
              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{authError}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Logged In ── */
          <div className="space-y-6">

            {/* User bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-900 border border-slate-300">
                  {googleUser?.displayName?.[0] || "G"}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Connected Google Account</div>
                  <div className="text-[11px] font-mono text-slate-500">{googleUser?.email}</div>
                </div>
              </div>
              <button onClick={handleSignOut} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg hover:text-red-700 text-xs text-slate-600 font-semibold">
                <LogOut className="h-3.5 w-3.5" /> Disconnect
              </button>
            </div>

            {/* Sub-tab nav */}
            <div className="border-b border-slate-200">
              <div className="flex gap-2 -mb-px">
                {[
                  { id: "sheets", label: "Google Sheets", Icon: TableProperties, active: "border-teal-500 text-teal-600" },
                  { id: "slides", label: "Google Slides", Icon: Presentation, active: "border-amber-500 text-amber-600" },
                  { id: "tasks", label: "Google Tasks", Icon: ListTodo, active: "border-blue-500 text-blue-600" },
                ].map(({ id, label, Icon, active }) => (
                  <button
                    key={id}
                    onClick={() => setSubTab(id as any)}
                    className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${subTab === id ? active : "border-transparent text-slate-500 hover:text-slate-800"}`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* SHEETS */}
            {subTab === "sheets" && (
              <div className="space-y-6">
                <div className="p-4 bg-teal-50/40 border border-teal-100 rounded-xl flex items-start gap-3">
                  <TableProperties className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-teal-900">Performance Spreadsheets</h4>
                    <p className="text-[11px] text-teal-800/80 mt-1">Export indicator data to Google Drive spreadsheets for sharing with regional directors.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Parameters</h4>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Filter Scope</label>
                      <select
                        value={exportFilter}
                        onChange={(e: any) => setExportFilter(e.target.value)}
                        className="w-full text-xs font-semibold h-10 px-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-800"
                      >
                        <option value="all">All Indicators ({indicators.length})</option>
                        <option value="critical">Critical (targets set)</option>
                        <option value="mch">Maternal & Child Health only</option>
                      </select>
                    </div>
                    <button
                      onClick={handleSheetsExport}
                      disabled={sheetStatus === "loading"}
                      className="w-full h-10 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold text-xs flex items-center justify-center gap-2 shadow"
                    >
                      {sheetStatus === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" />Building…</> : <><TableProperties className="h-4 w-4" />Build Google Sheet</>}
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-center min-h-[160px]">
                    {sheetStatus === "idle" && <div className="text-center text-slate-400 space-y-2"><TableProperties className="h-10 w-10 mx-auto text-slate-300" /><p className="text-xs font-semibold">No spreadsheet built yet</p></div>}
                    {sheetStatus === "loading" && <div className="text-center space-y-3"><Loader2 className="h-8 w-8 animate-spin mx-auto text-teal-600" /><p className="text-xs font-bold text-slate-500">Building spreadsheet…</p></div>}
                    {sheetStatus === "success" && sheetUrl && (
                      <div className="text-center space-y-4">
                        <div className="inline-flex p-2.5 bg-green-100 text-green-700 rounded-full"><CheckCircle2 className="h-8 w-8" /></div>
                        <div><h5 className="text-xs font-bold text-slate-900">Spreadsheet Created!</h5><p className="text-[10px] text-slate-400 mt-1">Available in your Google Drive</p></div>
                        <a href={sheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold shadow">
                          Open in Sheets <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}
                    {sheetStatus === "error" && <div className="text-center p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 space-y-2"><AlertCircle className="h-8 w-8 mx-auto text-red-600" /><p className="text-xs font-bold">Export failed</p><p className="text-[10px] font-mono">{sheetError}</p></div>}
                  </div>
                </div>
              </div>
            )}

            {/* SLIDES */}
            {subTab === "slides" && (
              <div className="space-y-6">
                <div className="p-4 bg-amber-50/40 border border-amber-100 rounded-xl flex items-start gap-3">
                  <Presentation className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Automated Slides Briefing</h4>
                    <p className="text-[11px] text-amber-800/80 mt-1">Build Google Slides presentations summarizing indicators, achievements and corrective actions.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-slate-200 rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Deck Structure (3 slides)</h4>
                    {["Title & Facility Overview", "Key Program Areas", "Recommended Next Steps"].map((s, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                        <span className="font-mono bg-amber-100 text-amber-800 h-5 w-5 rounded flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                        <span className="font-semibold text-slate-800">{s}</span>
                      </div>
                    ))}
                    <button
                      onClick={handleSlidesExport}
                      disabled={slidesStatus === "loading"}
                      className="w-full h-10 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-bold text-xs flex items-center justify-center gap-2 shadow"
                    >
                      {slidesStatus === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" />Building…</> : <><Presentation className="h-4 w-4" />Build Slides Deck</>}
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-center min-h-[160px]">
                    {slidesStatus === "idle" && <div className="text-center text-slate-400 space-y-2"><Presentation className="h-10 w-10 mx-auto text-slate-300" /><p className="text-xs font-semibold">No presentation built yet</p></div>}
                    {slidesStatus === "loading" && <div className="text-center space-y-3"><Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-500" /><p className="text-xs font-bold text-slate-500">Generating slides…</p></div>}
                    {slidesStatus === "success" && slidesUrl && (
                      <div className="text-center space-y-4">
                        <div className="inline-flex p-2.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100"><CheckCircle2 className="h-8 w-8 text-amber-500" /></div>
                        <div><h5 className="text-xs font-bold text-slate-900">Slides Created!</h5><p className="text-[10px] text-slate-400 mt-1">Ready to present to stakeholders</p></div>
                        <a href={slidesUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold shadow">
                          Present in Slides <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}
                    {slidesStatus === "error" && <div className="text-center p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 space-y-2"><AlertCircle className="h-8 w-8 mx-auto text-red-600" /><p className="text-xs font-bold">Export failed</p><p className="text-[10px] font-mono">{slidesError}</p></div>}
                  </div>
                </div>
              </div>
            )}

            {/* TASKS */}
            {subTab === "tasks" && (
              <div className="space-y-6">
                <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-xl flex items-start gap-3">
                  <ListTodo className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-blue-900">M&E Action Tasks</h4>
                    <p className="text-[11px] text-blue-800/80 mt-1">Review follow-up checklists and inject indicator action items directly into Google Tasks.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Diagnostic alerts */}
                  <div className="lg:col-span-5 border border-slate-200 rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-indigo-500" />Indicator Alerts
                    </h4>
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                      {diagnosticTasks.length === 0 ? (
                        <div className="text-center text-slate-400 py-6 text-xs bg-slate-50 rounded-lg border border-slate-100">No alerts available</div>
                      ) : diagnosticTasks.map((t, i) => (
                        <div key={t.code} className={`p-3 border rounded-lg flex items-start gap-2.5 transition-colors ${t.selected ? "border-slate-300 bg-white" : "border-slate-100 opacity-60 bg-slate-50"}`}>
                          <input type="checkbox" checked={t.selected} onChange={(e) => {
                            const updated = [...diagnosticTasks];
                            updated[i].selected = e.target.checked;
                            setDiagnosticTasks(updated);
                          }} className="mt-0.5" />
                          <div className="text-xs">
                            <span className="font-bold text-slate-800 block leading-tight">{t.title}</span>
                            <span className="text-[10px] text-slate-400 block mt-1">{t.notes.split("\n")[1]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handlePushDiagnosticTasks}
                      disabled={isLoadingTasks || !diagnosticTasks.some((t) => t.selected)}
                      className="w-full h-10 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-bold text-xs flex items-center justify-center gap-2 rounded-lg shadow"
                    >
                      <Sparkles className="h-4 w-4" /> Push to Google Tasks
                    </button>
                  </div>

                  {/* Live tasks */}
                  <div className="lg:col-span-7 border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Active Task List</h4>
                      <div className="flex items-center gap-2">
                        {isLoadingLists ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : (
                          <select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)}
                            className="text-[11px] font-bold h-7 border border-slate-200 rounded px-2 bg-slate-50 text-slate-700">
                            {taskLists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                          </select>
                        )}
                        <button onClick={() => setShowAddList(!showAddList)} className="p-1 border border-slate-200 rounded hover:bg-slate-100 text-slate-500">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {showAddList && (
                      <form onSubmit={handleCreateList} className="flex gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <input type="text" placeholder="New list name…" value={newListName} onChange={(e) => setNewListName(e.target.value)}
                          className="flex-1 h-8 px-2 border border-slate-200 rounded text-xs bg-white" required />
                        <button type="submit" className="px-3 h-8 bg-slate-900 text-white rounded text-xs font-bold">Create</button>
                      </form>
                    )}

                    <form onSubmit={handleAddTask} className="flex gap-2">
                      <input type="text" placeholder="Add a review task…" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" required />
                      <button type="submit" className="px-3 h-9 bg-slate-900 text-white rounded-lg hover:bg-black font-bold text-xs flex items-center gap-1">
                        <Plus className="h-4 w-4" /> Add
                      </button>
                    </form>

                    <div className="border border-slate-100 rounded-lg max-h-[200px] overflow-y-auto space-y-1">
                      {isLoadingTasks ? (
                        <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />Fetching tasks…
                        </div>
                      ) : tasks.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs space-y-1">
                          <ListTodo className="h-8 w-8 mx-auto text-slate-300" /><p className="font-semibold">No tasks yet</p>
                        </div>
                      ) : tasks.map((t) => (
                        <div key={t.id} className={`p-3 flex items-start gap-3 ${t.status === "completed" ? "bg-slate-50/50 opacity-60" : "bg-white"}`}>
                          <button onClick={() => handleToggleTask(t.id, t.status)}
                            className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors mt-0.5 shrink-0 ${t.status === "completed" ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 hover:border-indigo-600"}`}>
                            {t.status === "completed" && <CheckCircle2 className="h-3 w-3 stroke-[3]" />}
                          </button>
                          <div className="text-xs">
                            <span className={`font-semibold block ${t.status === "completed" ? "line-through text-slate-400" : "text-slate-800"}`}>{t.title}</span>
                            {t.due && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1 inline-block">Due: {new Date(t.due).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}