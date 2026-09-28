import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;

// Fail on first query, not at import, so a build without env vars still completes.
const missing = () => {
  throw new Error("DATABASE_URL is not set — run `neon link` locally or add it to the Vercel project");
};

export const sql: NeonQueryFunction<false, false> = url
  ? neon(url)
  : (new Proxy(missing, { apply: missing, get: missing }) as unknown as NeonQueryFunction<false, false>);
