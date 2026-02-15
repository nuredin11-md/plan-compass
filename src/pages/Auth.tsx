import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, LogIn, UserPlus } from "lucide-react";
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
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: displayName,
          department,
          role: DEFAULT_USER_ROLE, // Always set to viewer - admins must assign roles
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 header-gradient text-primary-foreground px-6 py-3 rounded-xl mb-4">
            <Activity className="h-6 w-6" />
            <span className="font-bold text-lg">Hospital M&E Platform</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to access your M&E dashboard" : "Create your account to get started"}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Full Name</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Dr. John Doe"
                  required
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.org"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {mode === "signup" && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Department</label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  <p className="font-medium">Role Assignment</p>
                  <p>Your role will be assigned by an administrator after email verification for security purposes.</p>
                </div>
              </>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {mode === "login" ? (
                <><LogIn className="h-4 w-4" /> Sign In</>
              ) : (
                <><UserPlus className="h-4 w-4" /> Create Account</>
              )}
            </Button>
          </form>

          <div className="text-center text-sm">
            {mode === "login" ? (
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <button onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
