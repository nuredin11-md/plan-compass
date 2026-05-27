import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, LogIn, UserPlus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const DEPARTMENTS = [
  "Maternal & Child Health",
  "Child Health",
  "Nutrition",
  "HIV/AIDS & STI",
  "Tuberculosis",
  "Malaria",
  "WASH",
  "NCD",
  "Health System Strengthening",
];

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  
  const [department, setDepartment] = useState("");
  
  // Remove role selection from signup - roles must be assigned by admin only
  const DEFAULT_USER_ROLE = "viewer";
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back!");
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!department) {
      toast.error("Please select a department");
      return;
    }
    
    if (!displayName) {
      toast.error("Please enter your full name");
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName,
          department,
          role: DEFAULT_USER_ROLE,
        },
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created! Check your email to verify your account.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-tr from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center p-4">
      
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#020617_1px,transparent_1px),linear-gradient(to_bottom,#020617_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {/* Glowing backdrop circular nodes */}
      <div className="absolute top-[10%] left-[10%] h-[350px] w-[350px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] h-[350px] w-[350px] rounded-full bg-teal-500/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-4 py-2 rounded-xl mb-3 shadow-inner">
            <Activity className="h-5 w-5 text-indigo-400 animate-pulse" />
            <span className="font-extrabold text-sm tracking-widest font-sans">PLAN COMPASS</span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Clinical Decisions Gateway</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            {mode === "login" ? "Authorize credentials to compute operational indices." : "Create your account to track indicator telemetry."}
          </p>
        </div>

        {/* Auth Glassmorphism Card Container */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-xl p-6 shadow-2xl space-y-4">
          <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Dr. John Doe"
                  required
                  className="bg-slate-950/80 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:ring-indigo-500 h-9 text-xs"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hospital Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.org"
                required
                className="bg-slate-950/80 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:ring-indigo-500 h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-slate-950/80 border-slate-800 text-slate-200 placeholder:text-slate-600 focus-visible:ring-indigo-500 h-9 text-xs"
              />
            </div>

            {mode === "signup" && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">M&E Operating Specialty</label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger className="bg-slate-950/80 border-slate-800 text-slate-400 focus:ring-indigo-500 h-9 text-xs">
                      <SelectValue placeholder="Select your department" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-slate-300">
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d} className="focus:bg-indigo-600 focus:text-white text-xs">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-900/40 rounded-xl p-3 text-[11px] text-indigo-300 leading-relaxed font-semibold">
                  <p className="font-bold flex items-center gap-1.5 text-indigo-200 mb-0.5"><ShieldCheck className="h-3.5 w-3.5 text-indigo-400" /> Active Roster Verification</p>
                  Your security clearance profile defaults to read-only. Administrators verify and upgrade access nodes.
                </div>
              </div>
            )}

            <Button type="submit" className="w-full h-9 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-600/15 cursor-pointer mt-4" disabled={loading}>
              {loading ? (
                <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
              ) : mode === "login" ? (
                <><LogIn className="h-3.5 w-3.5" /> Enter Portal</>
              ) : (
                <><UserPlus className="h-3.5 w-3.5" /> Register Profile</>
              )}
            </Button>
          </form>

          <div className="text-center text-xs border-t border-slate-800/80 pt-3.5">
            {mode === "login" ? (
              <p className="text-slate-400">
                Lacking credentials?{" "}
                <button onClick={() => setMode("signup")} className="text-indigo-400 font-bold hover:underline select-text cursor-pointer">
                  Request Roster Entry
                </button>
              </p>
            ) : (
              <p className="text-slate-400">
                Credentials exist?{" "}
                <button onClick={() => setMode("login")} className="text-indigo-400 font-bold hover:underline select-text cursor-pointer">
                  Authorize Credentials
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
