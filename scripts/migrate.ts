import "./_env";
import { readFileSync } from "node:fs";
import { sql } from "../lib/db";

const ddl = readFileSync(new URL("./migrate.sql", import.meta.url), "utf8");
// The HTTP driver runs one statement per call.
for (const stmt of ddl.replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean)) {
  await sql.query(stmt);
}
const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`;
console.log("Tables:", tables.map((t) => t.table_name).join(", "));
