// Server-only Google Gemini helper (strict JSON output) using GEMINI_API_KEY.
import { createResponsesCall } from "./ai/responses";
export { createResponsesCall as streamPlanCoach };
export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const MODEL = "gemini-3.8-flash";

type Json = Record<string, unknown>;

/** Build a strict JSON-schema object: every property required, no extras. */
export function obj(properties: Record<string, Json>): Json {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
export const str = (description?: string): Json =>
  description ? { type: "string", description } : { type: "string" };
export const num = (): Json => ({ type: "number" });
export const bool = (): Json => ({ type: "boolean" });
export const arr = (items: Json): Json => ({ type: "array", items });
export const en = (values: string[]): Json => ({ type: "string", enum: values });

export class AIError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function aiJSON<T>(opts: {
  name: string;
  schema: Json;
  system: string;
  content: Json[]; // user content parts (input_text / input_image / input_file)
  history?: { role: "user" | "assistant"; text: string }[];
}): Promise<T> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new AIError("AI is not configured. Add GEMINI_API_KEY.", 401);

  const toPart = (c: Json): Json => {
    if (c["type"] === "input_text" || c["type"] === "output_text") return { text: String(c["text"] ?? "") };
    const url = String(c["image_url"] ?? c["file_data"] ?? "");
    const m = url.match(/^data:([^;]+);base64,(.*)$/s);
    if (m) return { inlineData: { mimeType: m[1], data: m[2] } };
    return { text: String(c["text"] ?? "") };
  };
  const contents: Json[] = [];
  for (const h of opts.history ?? []) {
    contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text }] });
  }
  contents.push({ role: "user", parts: opts.content.map(toPart) });

  // Stream so long generations keep the connection alive.
  const res = await fetch(`${GEMINI_BASE}/models/${MODEL}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents,
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: opts.schema },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text();
    let message = "The AI service had a problem. Please try again in a moment.";
    try {
      const j = JSON.parse(body);
      message = j?.error?.message || j?.[0]?.error?.message || message;
    } catch {
      /* ignore */
    }
    if (res.status === 429)
      message = "The AI is busy or the Gemini free-tier limit was reached. Please wait and try again.";
    if (res.status === 503)
      message = "Google Gemini is overloaded right now. Please try again in a minute.";
    if (res.status === 524 || res.status === 504)
      message = "The AI took too long to respond. Please try again.";
    console.error("Gemini error", res.status, body.slice(0, 500));
    throw new AIError(message, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let ev: {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
        error?: { message?: string };
      };
      try {
        ev = JSON.parse(payload);
      } catch {
        continue;
      }
      if (ev.error) throw new AIError(ev.error.message || "The AI service had a problem.", 502);
      if (ev.promptFeedback?.blockReason)
        throw new AIError("The AI declined to process this request.", 400);
      for (const part of ev.candidates?.[0]?.content?.parts ?? [])
        if (part.text && !part.thought) text += part.text;
    }
  }
  const out = text;
  if (!out.trim()) throw new AIError("The AI returned an empty answer.", 502);
  return JSON.parse(out) as T;
}
