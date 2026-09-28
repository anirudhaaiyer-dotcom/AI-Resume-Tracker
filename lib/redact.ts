// Strip name, contact details, address, college, age/gender before any LLM call.
// Contact details are kept separately for the UI only.

export type Contact = { name: string; email: string | null; phone: string | null; links: string[] };

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d[\d\s-]{7,12}\d/g;
const URL = /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|flowcv\.me|behance\.net|medium\.com)\/?[\w\-/.%]*/gi;
// Outside the Education section only unambiguous names are redacted. Short acronyms like
// FMS / MDI / IMT / ISB collide with work text ("the company's FMS vendor" = freight
// management system), so they are left to the section rule below.
const INSTITUTION_WORDS = /\b(universit(y|ies)|college|institute of|school of|business school|academy)\b/i;
const INSTITUTION_NAMES = /\b(IIT|IIM|NIT|IIIT|BITS Pilani|IISc|VJTI|XLRI|NMIMS|SPJIMR|Symbiosis|Manipal|Amity)\b/; // case-sensitive
const isInstitution = (line: string) => INSTITUTION_WORDS.test(line) || INSTITUTION_NAMES.test(line);

// Inside an Education section (PDF text order is unreliable, so the section may run into
// job lines): redact only lines that look academic, including the short acronyms.
const ACADEMIC =
  /\b(B\.?\s?Tech|B\.?\s?E\.?|M\.?\s?Tech|MBA|PGDM|PGP|B\.?\s?Com|B\.?\s?Sc|M\.?\s?Sc|BBA|BCA|MCA|Ph\.?\s?D|Bachelor|Master|Diploma|Dual Degree|CGPA|GPA|CPI|Class (X|XII)|HSC|SSC|ICSE|CBSE|Board|Batch|Hons|Honours|Distinction|First Class|Gold Medal|Major|Minor|school|institute|college|universit(y|ies)|academy)\b/i;
const EDU_ACRONYMS = /\b(FMS|MDI|IMT|ISB|BITS|VIT|SRM|IISc|DTU|NSUT|COEP|PICT|RVCE|PESU|KIIT|LPU)\b/; // case-sensitive
const isAcademic = (line: string) => ACADEMIC.test(line) || EDU_ACRONYMS.test(line) || /^\s*(19|20)\d{2}\s*[-–]\s*((19|20)\d{2}|present)\s*$/i.test(line);

// Section headings: short lines naming a CV section.
const EDU_HEADING = /^\s*(education(al)?( qualifications?| details| background)?|academics?( qualifications?| details)?|qualifications)\s*:?\s*$/i;
const OTHER_HEADING =
  /^\s*((work |professional |relevant )?experience|employment|skills|core skills|key skills|certifications?( & (skills|tools|other))?|projects?|achievements|awards|summary|professional summary|profile|publications|interests|languages|positions of responsibility|extra-?curricular|leadership|volunteering|tools)\b.{0,30}$/i;
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

  let inEducation = false;
  const lines = text.split("\n").map((line) => {
    if (EDU_HEADING.test(line)) {
      inEducation = true;
      return line;
    }
    if (inEducation && OTHER_HEADING.test(line)) inEducation = false;
    if ((inEducation && isAcademic(line)) || isInstitution(line)) return "[EDUCATION REDACTED]";
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
