// No LLM calls. Parses every CV, redacts it, and reports anything that still looks like PII.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { parseCv } from "../lib/parse";
import { nameFromFile, redact } from "../lib/redact";

const LEAK = {
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/,
  phone: /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/,
  college: /\b(IIT|IIM|NIT|BITS|VJTI|XLRI|University|Institute|College)\b/i,
};

let failures = 0;
for (const dir of ["data/hires", "data/applications"]) {
  for (const file of readdirSync(dir).filter((f) => /\.(pdf|docx|txt)$/i.test(f)).sort()) {
    try {
      const text = await parseCv(join(dir, file));
      const { redacted, contact } = redact(text, file);
      const leaks = Object.entries(LEAK).filter(([, re]) => re.test(redacted)).map(([k]) => k);
      const nameLeak = nameFromFile(file).filter((p) => p.length >= 3 && new RegExp(`\\b${p}\\b`, "i").test(redacted));
      if (nameLeak.length) leaks.push(`name(${nameLeak.join(",")})`);
      if (leaks.length) failures++;
      console.log(`${leaks.length ? "LEAK" : "ok  "} ${file.padEnd(34)} words=${String(redacted.split(/\s+/).length).padStart(4)} email=${contact.email ? "y" : "n"} ${leaks.join(" ")}`);
    } catch (e: any) {
      failures++;
      console.log(`FAIL ${file}: ${e.message}`);
    }
  }
}
console.log(`\n${failures} file(s) with issues`);
