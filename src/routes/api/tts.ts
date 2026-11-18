import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const MODEL = "gemini-2.5-flash-preview-tts";
const VOICE = "Fenrir";
const MX = "a friendly native man from Mexico City, with an authentic Mexican accent and natural conversational rhythm";
const ACCENTS: Record<string, string> = { "es-ES": MX, "es-MX": MX, "es-US": MX };

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Sign in required", { status: 401 });
        const sb = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!, { auth: { persistSession: false } });
        const { data: u } = await sb.auth.getUser(token);
        if (!u.user) return new Response("Sign in required", { status: 401 });

        const body = (await request.json().catch(() => null)) as { text?: string; accent?: string } | null;
        const text = (body?.text ?? "").trim().slice(0, 2000);
        if (!text) return new Response("No text", { status: 400 });
        const who = ACCENTS[body?.accent ?? "es-ES"] ?? ACCENTS["es-ES"];
        const key = process.env['GEMINI_API_KEY'];
        if (!key) return new Response("Voice is not configured", { status: 500 });

        const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `Speak as ${who}, warm and natural. Pronounce every word and syllable completely, cleanly, and distinctly from start to finish. Include a natural trailing pause at the end so no word is cut short. Say only this text:\n\n${/[.!?…]$/.test(text) ? text : `${text}.`}` }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
            },
          }),
        });
        if (!upstream.ok) {
          const err = await upstream.text();
          console.error(`TTS failed [${upstream.status}]: ${err}`);
          return new Response("Voice failed", { status: upstream.status });
        }
        const j = (await upstream.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
        const b64 = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
        if (!b64) return new Response("Voice failed", { status: 502 });
        const pcm = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        // Gemini returns raw 16-bit mono PCM at 24kHz; wrap it in a WAV header.
        const header = new ArrayBuffer(44);
        const v = new DataView(header);
        const w = (o: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
        w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt ");
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, 24000, true); v.setUint32(28, 48000, true); v.setUint16(32, 2, true);
        v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length, true);
        const wav = new Uint8Array(44 + pcm.length);
        wav.set(new Uint8Array(header), 0); wav.set(pcm, 44);
        return new Response(wav, { status: 200, headers: { "Content-Type": "audio/wav", "Cache-Control": "no-cache" } });
      },
    },
  },
});
