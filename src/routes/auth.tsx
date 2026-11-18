import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => z.object({ mode: z.enum(["login", "signup", "forgot"]).optional() }).parse(s),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sign in — Weekly Language Coach" },
      { name: "description", content: "Sign in or create your Weekly Language Coach account." },
      { property: "og:title", content: "Sign in — Weekly Language Coach" },
      { property: "og:description", content: "Sign in or create your Weekly Language Coach account." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const pwSchema = z.string().min(8, "Use at least 8 characters").max(72);

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/home" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const em = emailSchema.safeParse(email);
    if (!em.success) { toast.error(em.error.issues[0]?.message ?? "Invalid email"); return; }
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(em.data, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent("Check your email for a link to reset your password.");
        return;
      }
      const pw = pwSchema.safeParse(password);
      if (!pw.success) { toast.error(pw.error.issues[0]?.message ?? "Invalid password"); return; }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: em.data,
          password: pw.data,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name.trim().slice(0, 80) || undefined } },
        });
        if (error) throw error;
        if (!data.session) setSent("Almost there! Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: em.data, password: pw.data });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

async function google() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) {
    toast.error("Google sign-in failed");
  }
}

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-sm">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
          <GraduationCap className="h-5 w-5 text-primary" /> Weekly Language Coach
        </Link>
        <h1 className="mt-10 text-4xl font-semibold">
          {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back"}
        </h1>
        {sent ? (
          <div className="mt-8 rounded-3xl border bg-card p-6">
            <p>{sent}</p>
            <Button variant="link" className="mt-2 px-0" onClick={() => { setSent(null); setMode("login"); }}>Back to sign in</Button>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl" maxLength={80} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl" required />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="pw">Password</Label>
                  <Input id="pw" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 rounded-xl" required />
                </div>
              )}
              <Button type="submit" disabled={busy} className="h-12 w-full rounded-xl text-base">
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
              </Button>
            </form>
            {mode !== "forgot" && (
              <>
                <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
                <Button variant="outline" className="h-12 w-full rounded-xl" onClick={google}>Continue with Google</Button>
              </>
            )}
            <div className="mt-6 space-y-2 text-sm">
              {mode === "login" && (
                <>
                  <button className="block text-muted-foreground underline" onClick={() => setMode("forgot")}>Forgot password?</button>
                  <button className="block font-medium text-primary" onClick={() => setMode("signup")}>New here? Create an account</button>
                </>
              )}
              {mode !== "login" && <button className="block font-medium text-primary" onClick={() => setMode("login")}>Already have an account? Sign in</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
