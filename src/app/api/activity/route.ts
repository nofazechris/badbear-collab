import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema, CollabStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const log = await sql`
      SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 200
    `;
    const leaderboard = await sql`
      SELECT va_name, COUNT(*) FILTER (WHERE status = 'closed') AS closed_count,
             COUNT(*) FILTER (WHERE status = 'dmsent') AS dmsent_count,
             COUNT(*) AS total_actions
      FROM activity_log
      GROUP BY va_name
      ORDER BY closed_count DESC, total_actions DESC
    `;
    return NextResponse.json({ log, leaderboard });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}

// Lets a VA log an outreach action directly (not tied to a status change
// on a specific tracked project) — e.g. logging a DM sent to someone not
// yet in the projects table.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { va_name, project_name, status } = body as {
      va_name: string;
      project_name: string;
      status: CollabStatus;
    };

    const validStatuses: CollabStatus[] = ["none", "dmsent", "closed", "failed"];
    if (!va_name || !project_name || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "va_name, project_name, and a valid status are required" }, { status: 400 });
    }

    await ensureSchema();
    const rows = await sql`
      INSERT INTO activity_log (project_symbol, project_name, va_name, status)
      VALUES (${project_name.toLowerCase().replace(/\s+/g, "_")}, ${project_name}, ${va_name}, ${status})
      RETURNING *
    `;
    return NextResponse.json({ entry: rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }
}

// Edits an existing log entry — e.g. moving a deal from "DM sent" to
// "closed" as it progresses, or fixing a typo in who/what was logged.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, va_name, project_name, status } = body as {
      id: number;
      va_name?: string;
      project_name?: string;
      status?: CollabStatus;
    };

    const validStatuses: CollabStatus[] = ["none", "dmsent", "closed", "failed"];
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await ensureSchema();
    const existing = await sql`SELECT * FROM activity_log WHERE id = ${id}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Log entry not found" }, { status: 404 });
    }

    const next = {
      va_name: va_name !== undefined ? va_name : existing[0].va_name,
      project_name: project_name !== undefined ? project_name : existing[0].project_name,
      status: status !== undefined ? status : existing[0].status
    };

    const rows = await sql`
      UPDATE activity_log
      SET va_name = ${next.va_name}, project_name = ${next.project_name}, status = ${next.status}
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({ entry: rows[0] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update log entry" }, { status: 500 });
  }
}

// Deletes a log entry permanently.
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }

    await ensureSchema();
    const rows = await sql`DELETE FROM activity_log WHERE id = ${Number(id)} RETURNING id`;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Log entry not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id: rows[0].id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete log entry" }, { status: 500 });
  }
}
