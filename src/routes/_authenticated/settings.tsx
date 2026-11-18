import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LANGUAGES } from "@/lib/languages";
import { PageTitle } from "@/components/coach/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Profile & settings — Weekly Language Coach" },
      { name: "description", content: "Manage your profile and study settings." },
      { property: "og:title", content: "Profile & settings — Weekly Language Coach" },
      { property: "og:description", content: "Manage your profile and study settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["profile-settings"],
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("*").maybeSingle();
      const { data: settings } = await supabase.from("user_settings").select("*").maybeSingle();
      return { profile, settings };
    },
  });
  const [name, setName] = useState("");
  const [level, setLevel] = useState("beginner");
  const [accent, setAccent] = useState("es-ES");
  const [rate, setRate] = useState(0.9);
  const [pw, setPw] = useState({ current: "", next: "" });

  useEffect(() => {
    if (!data) return;
    setName(data.profile?.display_name ?? "");
    setLevel(data.profile?.level ?? "beginner");
    setAccent(data.settings?.voice_accent ?? "es-ES");
    setRate(Number(data.settings?.speech_rate ?? 0.9));
  }, [data]);

  async function save() {
    if (!user) return;
    const a = await supabase.from("profiles").upsert({ id: user.id, display_name: name.trim().slice(0, 80), level, updated_at: new Date().toISOString() });
    const b = await supabase.from("user_settings").upsert({ user_id: user.id, voice_accent: accent, speech_rate: rate, updated_at: new Date().toISOString() });
    if (a.error || b.error) { toast.error((a.error ?? b.error)!.message); return; }
    await supabase.auth.updateUser({ data: { display_name: name.trim().slice(0, 80) } });
    qc.invalidateQueries();
    toast.success("Saved");
  }

  async function changePassword() {
    if (pw.next.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    const { error } = await supabase.auth.updateUser({ password: pw.next, current_password: pw.current } as never);
    if (error) { toast.error(error.message); return; }
    setPw({ current: "", next: "" });
    toast.success("Password changed");
  }

  async function logout() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/" });
  }

  return (
    <div className="animate-rise space-y-5">
      <PageTitle eyebrow="Me" title="Profile & settings">{user?.email}</PageTitle>

      <section className="space-y-4 rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="space-y-1.5"><Label htmlFor="n">Name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl" /></div>
        <div className="space-y-1.5">
          <Label>Learning</Label>
          <div className="h-12 rounded-xl border bg-muted px-3 leading-[3rem]">{LANGUAGES.es.name} ({LANGUAGES.es.nativeName})</div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lvl">Level</Label>
          <select id="lvl" value={level} onChange={(e) => setLevel(e.target.value)} className="h-12 w-full rounded-xl border bg-card px-3">
            <option value="beginner">Beginner</option>
            <option value="elementary">Elementary</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Study settings</h2>
        <div className="text-sm text-muted-foreground">Daily goal: 60 minutes, Monday to Friday.</div>
        <div className="space-y-1.5">
          <Label htmlFor="acc">Listening accent</Label>
          <select id="acc" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-12 w-full rounded-xl border bg-card px-3">
            {LANGUAGES.es.accents.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rate">Audio speed: {rate.toFixed(2)}×</Label>
          <input id="rate" type="range" min={0.6} max={1.2} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
        </div>
      </section>

      <Button onClick={save} className="h-12 w-full rounded-2xl">Save changes</Button>

      <section className="space-y-3 rounded-3xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Change password</h2>
        <Input type="password" placeholder="Current password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className="h-12 rounded-xl" />
        <Input type="password" placeholder="New password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className="h-12 rounded-xl" />
        <Button variant="outline" onClick={changePassword} className="h-11 w-full rounded-xl">Update password</Button>
      </section>

      <Button variant="ghost" onClick={logout} className="h-12 w-full rounded-2xl text-destructive"><LogOut className="h-4 w-4" /> Log out</Button>
    </div>
  );
}
