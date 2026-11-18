import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, FileUp, X, ArrowUp, ArrowDown, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeLesson } from "@/lib/coach.functions";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/coach/bits";
import { useAuth } from "@/hooks/use-auth";
import { ACCEPT, fileKind, extractText } from "@/lib/extract-text";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Add homework — Weekly Language Coach" },
      { name: "description", content: "Photograph or upload this week's homework files." },
      { property: "og:title", content: "Add homework — Weekly Language Coach" },
      { property: "og:description", content: "Photograph or upload this week's homework files." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { mode?: "upload" } => (s["mode"] === "upload" ? { mode: "upload" } : {}),
  component: ScanPage,
});

type Page = { id: string; file: File; preview: string | null; original?: File };

async function downscale(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = 2000;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.85));
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const STAGES = ["Uploading pages…", "Reading your homework…", "Finding vocabulary and grammar…", "Checking corrections and mistakes…", "Almost done…"];

function ScanPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const analyze = useServerFn(analyzeLesson);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { mode } = Route.useSearch();

  useEffect(() => {
    if (mode === "upload") fileRef.current?.click();
  }, [mode]);

  async function add(files: FileList | null) {
    if (!files) return;
    const next: Page[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name} is larger than 20MB`);
        continue;
      }
      const kind = fileKind(f);
      if (kind === "unsupported") {
        toast.error(`${f.name}: this file type isn't supported. Try saving it as a PDF.`);
        continue;
      }
      let file: File = f;
      if (kind === "heic") {
        try {
          const heic2any = (await import("heic2any")).default;
          const out = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.85 });
          file = new File([Array.isArray(out) ? out[0]! : out], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
        } catch {
          toast.error(`${f.name}: couldn't open this photo. Try a screenshot instead.`);
          continue;
        }
      } else if (kind !== "image" && kind !== "pdf" && kind !== "text") {
        try {
          const text = await extractText(f);
          if (!text.trim()) throw new Error("empty");
          next.push({ id: crypto.randomUUID(), file: new File([text], f.name + ".txt", { type: "text/plain" }), preview: null, original: f });
        } catch {
          toast.error(`${f.name}: couldn't read this file. Please save it as a PDF and upload that.`);
        }
        continue;
      }
      next.push({ id: crypto.randomUUID(), file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null });
    }
    setPages((p) => [...p, ...next]);
  }

  function move(i: number, d: number) {
    setPages((p) => {
      const c = [...p];
      const j = i + d;
      if (j < 0 || j >= c.length) return c;
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });
  }

  async function submit() {
    if (!pages.length || !user) return;
    setBusy(true);
    setStage(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const { data: lesson, error } = await supabase.from("weekly_lessons").insert({ user_id: user.id, language: "es" }).select().single();
      if (error) throw error;
      for (const [i, p] of pages.entries()) {
        const file = await downscale(p.file);
        const path = `${user.id}/${lesson.id}/${i + 1}-${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from("homework").upload(path, file, { contentType: file.type });
        if (up.error) throw up.error;
        if (p.original) {
          await supabase.storage.from("homework").upload(`${user.id}/${lesson.id}/originals/${crypto.randomUUID()}-${p.original.name.replace(/[^\w.-]/g, "_")}`, p.original, { contentType: p.original.type || "application/octet-stream" });
        }
        const ins = await supabase.from("uploaded_documents").insert({ user_id: user.id, lesson_id: lesson.id, storage_path: path, file_name: file.name, mime_type: file.type, page_order: i });
        if (ins.error) throw ins.error;
      }
      setStage(1);
      timer = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 9000);
      await analyze({ data: { lessonId: lesson.id } });
      await qc.invalidateQueries({ queryKey: ["lessons"] });
      navigate({ to: "/lessons/$id/review", params: { id: lesson.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    } finally {
      if (timer) clearInterval(timer);
    }
  }

  if (busy) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center animate-rise">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h2 className="mt-6 text-2xl font-semibold">{STAGES[stage]}</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">Analyzing {pages.length} page{pages.length > 1 ? "s" : ""} together. This can take up to a minute.</p>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <PageTitle eyebrow="Step 1" title="Add This Week's Homework">
        Take photos or upload files for every page of this week's lesson — teacher notes, worksheets, corrected homework, handwritten notes.
      </PageTitle>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={fileRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-3 rounded-[2rem] bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/25 active:scale-[0.98]">
          <Camera className="h-9 w-9" />
          <span className="font-semibold">Take photo</span>
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-3 rounded-[2rem] border-2 border-dashed bg-card p-6 active:scale-[0.98]">
          <FileUp className="h-9 w-9 text-primary" />
          <span className="font-semibold">Upload files</span>
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Photos, PDFs, Word, Excel, PowerPoint, Google Docs/Sheets · up to 20MB each</p>

      {pages.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold">{pages.length} page{pages.length > 1 ? "s" : ""} in this lesson</h3>
          <ul className="mt-3 space-y-2">
            {pages.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-2">
                {p.preview ? <img src={p.preview} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted"><FileText className="h-6 w-6" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">Page {i + 1}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.file.name}</div>
                </div>
                <div className="flex">
                  <Button size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setPages((ps) => ps.filter((x) => x.id !== p.id))} aria-label="Remove"><X className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={() => cameraRef.current?.click()} variant="outline" className="h-12 rounded-2xl"><Camera className="h-4 w-4" /> Take another photo</Button>
            <Button onClick={() => fileRef.current?.click()} variant="outline" className="h-12 rounded-2xl"><FileUp className="h-4 w-4" /> Upload more files</Button>
          </div>
          <Button onClick={submit} size="lg" className="mt-4 h-14 w-full rounded-2xl text-base">Analyze my homework</Button>
        </div>
      )}
    </div>
  );
}
