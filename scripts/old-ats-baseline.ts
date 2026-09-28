// "Old way" screen: what a keyword/credential ATS (or a tired founder skimming) rewards.
import { parseCv } from "../lib/parse";
import { readdirSync } from "node:fs";
const BUZZ = /\b(roadmap|stakeholder|OKRs?|JTBD|agile|scrum|PRDs?|KPIs?|frameworks?|strateg\w*|cross-functional|data-driven|go-to-market|GTM|north star|A\/B|user research|discovery|prioriti[sz]\w*|scal(e|ing|able)|enterprise|SaaS|growth|product-led|MBA|certifi\w+)\b/gi;
const ELITE = /\b(IIT|IIM|XLRI|ISB|BITS|NIT|VJTI|NMIMS|SPJIMR|FMS|MDI|Loyola|Symbiosis)\b/g;
const OPS = /\b(bills? of lading|customs|CHA|NVOCC|freight forward\w*|3PL|shipments?|carrier|berth|port|terminal|documentation|exception)\b/gi;
const GROUP: Record<string, string> = { lavanya: "Operator", rohan: "Operator", sunita: "Operator", aditya: "Operator", meghna: "Operator", preetham: "Spec", rahul: "Spec", vikram: "Spec" };
const ATS: Record<string, number> = { lavanya: 93.75, rohan: 85, meghna: 76.25, sunita: 68.75, aditya: 62.5, vikram: 40, preetham: 38.75, rahul: 32.5 };
const rows: any[] = [];
for (const f of readdirSync("data/hires").sort()) {
  const t = await parseCv("data/hires/" + f);
  const who = f.split("_")[2];
  const words = t.split(/\s+/).length;
  const buzz = (t.match(BUZZ) || []).length, elite = new Set(t.match(ELITE) || []).size, ops = (t.match(OPS) || []).length;
  const certs = (t.match(/certif|\(20\d\d\)/gi) || []).length;
  // Old-way score (0-100): JD-vocabulary density 50%, elite credentials 25%, certifications 25%.
  const old = Math.min(50, (buzz / words) * 1000 * 2.5) + Math.min(25, elite * 12.5) + Math.min(25, certs * 6.25);
  rows.push({ who, group: GROUP[who], old: +old.toFixed(1), buzzPer1k: +((buzz / words) * 1000).toFixed(1), elite, certs, opsPer1k: +((ops / words) * 1000).toFixed(1), rubric: ATS[who] });
}
rows.sort((a, b) => b.old - a.old);
console.table(rows);
