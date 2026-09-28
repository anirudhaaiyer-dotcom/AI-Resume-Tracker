import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

// CV file → plain text. Throws on unsupported / unreadable input; callers mark parse_failed.
export async function parseCv(path: string): Promise<string> {
  const buf = await readFile(path);
  const ext = extname(path).toLowerCase();
  let text: string;
  if (ext === ".pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text: pages } = await extractText(pdf, { mergePages: false });
    text = (pages as string[]).join("\n");
  } else if (ext === ".docx") {
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (ext === ".txt") {
    text = buf.toString("utf8");
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
  if (text.replace(/\s/g, "").length < 200) throw new Error("Too little text extracted");
  return text;
}

// Normalisation used for quote verification: the LLM may fix ligatures, curly quotes
// or line-wrapped spacing, which is not a paraphrase.
export function normalise(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[•▪◦·⋄—–]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function quoteInText(quote: string, text: string): boolean {
  const q = normalise(quote);
  return q.length >= 12 && normalise(text).includes(q);
}
