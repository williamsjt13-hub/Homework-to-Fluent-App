// Browser-side conversion of office documents into plain text the analyzer can read.

export const ACCEPT =
  "image/*,.heic,.heif,application/pdf,.pdf,text/plain,.txt,.csv,.rtf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp," +
  "application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
  "application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,application/rtf";

export type FileKind = "image" | "heic" | "pdf" | "text" | "doc" | "sheet" | "slides" | "rtf" | "unsupported";

export function ext(name: string) {
  return (name.split(".").pop() ?? "").toLowerCase();
}

export function fileKind(f: { name: string; type: string }): FileKind {
  const e = ext(f.name);
  if (e === "heic" || e === "heif" || /heic|heif/.test(f.type)) return "heic";
  if (f.type.startsWith("image/")) return "image";
  if (e === "pdf" || f.type === "application/pdf") return "pdf";
  if (e === "txt" || f.type === "text/plain") return "text";
  if (["docx", "odt", "doc"].includes(e)) return "doc";
  if (["xlsx", "xls", "ods", "csv"].includes(e)) return "sheet";
  if (["pptx", "odp", "ppt"].includes(e)) return "slides";
  if (e === "rtf") return "rtf";
  return "unsupported";
}

function xmlText(xml: string, paraTag: RegExp) {
  return xml
    .replace(paraTag, "\n")
    .replace(/<w:tab\/>|<text:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function rtfToText(rtf: string) {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode((Number(n) + 65536) % 65536))
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .trim();
}

export async function extractText(file: File): Promise<string> {
  const kind = fileKind(file);
  const e = ext(file.name);
  const buf: ArrayBuffer =
    typeof file.arrayBuffer === "function"
      ? await file.arrayBuffer()
      : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = rej; r.readAsArrayBuffer(file); });
  if (kind === "sheet") {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array" });
    return wb.SheetNames.map((n) => `## ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n]!)}`).join("\n\n").trim();
  }
  if (kind === "rtf") return rtfToText(new TextDecoder().decode(buf));
  if (e === "doc" || e === "ppt") throw new Error("old-format");
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  if (e === "docx") return xmlText((await zip.file("word/document.xml")?.async("string")) ?? "", /<\/w:p>/g);
  if (e === "odt" || e === "odp") return xmlText((await zip.file("content.xml")?.async("string")) ?? "", /<\/text:(p|h)>/g);
  if (e === "pptx") {
    const slides = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
    const out: string[] = [];
    for (const [i, p] of slides.entries()) out.push(`## Slide ${i + 1}\n` + xmlText(await zip.file(p)!.async("string"), /<\/a:p>/g));
    return out.join("\n\n");
  }
  throw new Error("unsupported");
}
