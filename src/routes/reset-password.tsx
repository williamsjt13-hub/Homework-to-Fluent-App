import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Set a new password — Weekly Language Coach" },
      { name: "description", content: "Choose a new password for your account." },
      { property: "og:title", content: "Set a new password — Weekly Language Coach" },
      { property: "og:description", content: "Choose a new password for your account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("Use at least 8 characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/home" });
  }

  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <form onSubmit={submit} className="mx-auto max-w-sm space-y-4">
        <h1 className="text-4xl font-semibold">New password</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-12 rounded-xl" />
        </div>
        <Button disabled={busy} className="h-12 w-full rounded-xl">Save password</Button>
      </form>
    </div>
  );
}
