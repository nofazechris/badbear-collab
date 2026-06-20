import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

interface IncomingProject {
  symbol: string;
  name: string;
  description?: string;
  twitter?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projects: IncomingProject[] = body.projects;

    if (!Array.isArray(projects) || projects.length === 0) {
      return NextResponse.json({ error: "projects must be a non-empty array" }, { status: 400 });
    }

    await ensureSchema();

    let inserted = 0;
    let skipped = 0;

    for (const p of projects) {
      if (!p.symbol || !p.name) {
        skipped++;
        continue;
      }
      await sql`
        INSERT INTO projects (symbol, name, description, twitter)
        VALUES (${p.symbol}, ${p.name}, ${p.description || null}, ${p.twitter || null})
        ON CONFLICT (symbol) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          twitter = EXCLUDED.twitter,
          updated_at = now()
      `;
      inserted++;
    }

    return NextResponse.json({ inserted, skipped });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to seed projects" }, { status: 500 });
  }
}
