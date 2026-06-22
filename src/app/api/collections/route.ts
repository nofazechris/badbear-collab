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
    const { symbol, status, assigned_to, va_name } = body as {
      symbol: string;
      status?: CollabStatus;
      assigned_to?: string;
      va_name?: string;
    };

    const validStatuses: CollabStatus[] = ["none", "dmsent", "closed", "failed"];
    if (!symbol) {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await ensureSchema();

    let rows;
    if (status !== undefined && assigned_to !== undefined) {
      rows = await sql`
        UPDATE projects
        SET status = ${status}, assigned_to = ${assigned_to}, updated_at = now()
        WHERE symbol = ${symbol}
        RETURNING *
      `;
    } else if (status !== undefined) {
      rows = await sql`
        UPDATE projects
        SET status = ${status}, updated_at = now()
        WHERE symbol = ${symbol}
        RETURNING *
      `;
    } else if (assigned_to !== undefined) {
      rows = await sql`
        UPDATE projects
        SET assigned_to = ${assigned_to}, updated_at = now()
        WHERE symbol = ${symbol}
        RETURNING *
      `;
    } else {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Log the action whenever a status change happens and we know who did it.
    if (status !== undefined && va_name) {
      await sql`
        INSERT INTO activity_log (project_symbol, project_name, va_name, status)
        VALUES (${symbol}, ${rows[0].name}, ${va_name}, ${status})
      `;
    }

    return NextResponse.json({ project: rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
