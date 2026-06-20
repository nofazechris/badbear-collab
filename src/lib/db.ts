import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it in your Vercel project's environment variables.");
}

export const sql = neon(process.env.DATABASE_URL);

export type CollabStatus = "none" | "dmsent" | "closed" | "failed";

export interface Project {
  id: number;
  symbol: string;
  name: string;
  description: string | null;
  twitter: string | null;
  status: CollabStatus;
  created_at: string;
  updated_at: string;
}

export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      symbol TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      twitter TEXT,
      status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none','dmsent','closed','failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}
