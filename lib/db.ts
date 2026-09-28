import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set — run `neon link` / check .env.local");

export const sql = neon(url);
