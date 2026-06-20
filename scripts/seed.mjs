/**
 * Seeds the projects table from snapshot.json.
 * Run locally after setting DATABASE_URL:
 *   DATABASE_URL="postgresql://..." node scripts/seed.mjs
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL before running this script.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  const raw = readFileSync(join(__dirname, "snapshot.json"), "utf-8");
  const { collections } = JSON.parse(raw);

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

  let count = 0;
  for (const c of collections) {
    await sql`
      INSERT INTO projects (symbol, name, description, twitter)
      VALUES (${c.symbol}, ${c.name}, ${c.description || null}, ${c.twitter || null})
      ON CONFLICT (symbol) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        twitter = EXCLUDED.twitter,
        updated_at = now()
    `;
    count++;
  }

  console.log(`Seeded ${count} projects.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
