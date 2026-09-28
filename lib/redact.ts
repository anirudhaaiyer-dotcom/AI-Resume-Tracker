// Strip name, contact details, address, college, age/gender before any LLM call.
// Contact details are kept separately for the UI only.

export type Contact = { name: string; email: string | null; phone: string | null; links: string[] };

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d[\d\s-]{7,12}\d/g;
const URL = /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|flowcv\.me|behance\.net|medium\.com)\/?[\w\-/.%]*/gi;
const INSTITUTION =
  /\b(universit(y|ies)|institute|college|school|academy|IIT|IIM|NIT|IIIT|BITS|VJTI|XLRI|ISB|NMIMS|SPJIMR|MDI|FMS|IMT|Symbiosis|Manipal|Amity|VIT|SRM|Anna Univ)\b/i;
const PERSONAL = /\b(date of birth|d\.?o\.?b|age\s*[:\-]|gender|marital status|nationality|father'?s name)\b/i;

// "cv_07_lavanya_iyer.pdf" / "pm_01_priya_krishnan" / "01_rohan_mehta" → ["lavanya","iyer"]
export function nameFromFile(file: string): string[] {
  const stem = file.replace(/\.[^.]+$/, "");
  return stem
    .split("_")
    .filter((p) => !/^(cv|pm|spm|\d+)$/i.test(p))
    .map((p) => p.toLowerCase());
}

export function redact(text: string, file: string): { redacted: string; contact: Contact } {
  const nameParts = nameFromFile(file);
  const contact: Contact = {
    name: nameParts.map((p) => p[0].toUpperCase() + p.slice(1)).join(" "),
    email: text.match(EMAIL)?.[0] ?? null,
    phone: text.match(PHONE)?.[0]?.trim() ?? null,
    links: [...new Set(text.match(URL) ?? [])],
  };

  const lines = text.split("\n").map((line) => {
    if (INSTITUTION.test(line)) return "[EDUCATION REDACTED]";
    if (PERSONAL.test(line)) return "[PERSONAL REDACTED]";
    // A contact line (email/phone/links) usually carries the city too — drop the whole line.
    if (EMAIL.test(line) || PHONE.test(line)) {
      EMAIL.lastIndex = PHONE.lastIndex = 0;
      return "[CONTACT REDACTED]";
    }
    return line.replace(URL, "[LINK]");
  });

  let redacted = lines.join("\n");
  for (const part of nameParts) {
    if (part.length < 3) continue;
    redacted = redacted.replace(new RegExp(`\\b${part}\\b`, "gi"), "[NAME]");
  }
  return { redacted, contact };
}
