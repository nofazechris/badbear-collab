import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema, CollabStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const rows = await sql`SELECT * FROM projects ORDER BY name ASC`;
    return NextResponse.json({ projects: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol, status } = body as { symbol: string; status: CollabStatus };

    const validStatuses: CollabStatus[] = ["none", "dmsent", "closed", "failed"];
    if (!symbol || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid symbol or status" }, { status: 400 });
    }

    await ensureSchema();
    const rows = await sql`
      UPDATE projects
      SET status = ${status}, updated_at = now()
      WHERE symbol = ${symbol}
      RETURNING *
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project: rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
