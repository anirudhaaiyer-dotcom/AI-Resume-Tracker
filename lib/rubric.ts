import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Role = "PM" | "SPM";
export type Criterion = "A" | "B" | "C" | "D" | "E" | "F";
export const CRITERIA: Criterion[] = ["A", "B", "C", "D", "E", "F"];

export type Levels = Record<Criterion, number>;

type Band = { min: number; max: number; label: string; suggestion: string };

export const rubric = JSON.parse(
  readFileSync(join(process.cwd(), "rubric.json"), "utf8"),
) as {
  weights: Record<Role, Record<Criterion, number>>;
  criteria: Record<Criterion, any>;
  bands: Band[];
  jd_experience: Record<Role, string>;
};

// Score = Σ(weight × level ÷ 4). Code does the maths, never the LLM.
export function computeScore(levels: Levels, role: Role): number {
  const w = rubric.weights[role];
  return CRITERIA.reduce((sum, c) => sum + (w[c] * levels[c]) / 4, 0);
}

export function bandFor(score: number): Band {
  // Highest band whose floor the score reaches — no gaps between e.g. 74.99 and 75.
  const byFloor = [...rubric.bands].sort((a, b) => b.min - a.min);
  return byFloor.find((b) => score >= b.min) ?? byFloor.at(-1)!;
}

const MIN_YEARS: Record<Role, number> = { PM: 2, SPM: 5 };

// Flags surface to Arjun; none of them ever triggers an action.
export function flagsFor(opts: {
  role: Role;
  levels: Levels;
  years: number;
  pmScore: number;
  spmScore: number;
}): string[] {
  const { role, levels, years, pmScore, spmScore } = opts;
  const flags: string[] = [];
  if (levels.A === 0 && levels.B === 0) flags.push("pattern_floor");
  if (role === "SPM" && levels.E <= 1) flags.push("spm_shipping_floor");
  if (role === "SPM" && spmScore < 55 && pmScore >= 75) flags.push("consider_for_pm");
  if (years < MIN_YEARS[role]) flags.push("experience_below_jd");
  return flags;
}

// Untagged CVs: suggest a role from PM-type years; Arjun confirms in the UI.
export function suggestRole(years: number): Role {
  return years >= MIN_YEARS.SPM ? "SPM" : "PM";
}

export function anchorsText(role: Role): string {
  return CRITERIA.map((c) => {
    const def = rubric.criteria[c];
    const levels = c === "E" ? def.levels_by_role[role] : def.levels;
    const lines = ["4", "3", "2", "1", "0"].map((l) => `    ${l}: ${levels[l]}`).join("\n");
    const note = def.role_notes?.[role] ? `\n    note (${role}): ${def.role_notes[role]}` : "";
    return `${c}. ${def.name} — ${def.question}\n${lines}${note}`;
  }).join("\n\n");
}
