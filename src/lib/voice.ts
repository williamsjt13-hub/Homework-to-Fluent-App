// Natural-sounding speech from the server voice, cached per sentence in memory.
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, Promise<string>>();
const ready = new Map<string, string>();

/** Already-downloaded audio URL, so playback can start instantly inside a tap. */
export function readySpeechUrl(text: string, accent = "es-ES"): string | undefined {
  return ready.get(`${accent}|${cleanSpeechText(text)}`);
}

/** Start downloading audio in the background so it's ready when needed. */
export function prefetchSpeech(texts: string[], accent = "es-ES") {
  for (const t of texts) if (t) speechUrl(t, accent).catch(() => {});
}

/** Strip study labels like "(review)" so only the real words are spoken. */
export function cleanSpeechText(text: string): string {
  return text.replace(/\((?:review|repaso)\)/gi, "").replace(/\s+/g, " ").trim();
}

export function speechUrl(rawText: string, accent = "es-ES"): Promise<string> {
  const text = cleanSpeechText(rawText);
  const k = `${accent}|${text}`;
  let p = cache.get(k);
  if (!p) {
    p = (async () => {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ text, accent }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(res.status === 402 ? "Out of AI credits for voice audio" : msg.slice(0, 160) || "Couldn't load audio");
      }
      const url = URL.createObjectURL(await res.blob());
      ready.set(k, url);
      return url;
    })();
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return p;
}
