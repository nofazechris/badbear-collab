import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it in your Vercel project's environment variables.");
}

export const sql = neon(process.env.DATABASE_URL);

export type CollabStatus = "none" | "dmsent" | "closed" | "failed";

// Edit this list to add/remove VAs. No login system — this is just
// what populates the dropdown so names stay consistent.
export const VA_NAMES = ["Unassigned", "Chris"];

export interface Project {
  id: number;
  symbol: string;
  name: string;
  description: string | null;
  twitter: string | null;
  status: CollabStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntry {
  id: number;
  project_symbol: string;
  project_name: string;
  va_name: string;
  status: CollabStatus;
  created_at: string;
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
      assigned_to TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Backfill for tables created before assigned_to existed.
  await sql`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_to TEXT
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      project_symbol TEXT NOT NULL,
      project_name TEXT NOT NULL,
      va_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('none','dmsent','closed','failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

