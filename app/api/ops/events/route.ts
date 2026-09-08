import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sql = await ensureOpsSchema();
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
    const rows = await sql`
      SELECT id, created_at, device_id, role, event_type, label, payload
      FROM ops_events
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return Response.json({ events: rows.map((row) => ({ ...row, created_at: Number(row.created_at) })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      deviceId?: string;
      role?: string;
      eventType?: string;
      label?: string;
      payload?: Record<string, unknown>;
    };
    const eventType = String(body.eventType || "").trim().slice(0, 80);
    if (!eventType) return Response.json({ error: "eventType is required" }, { status: 400 });
    const sql = await ensureOpsSchema();
    const createdAt = Date.now();
    const deviceId = String(body.deviceId || "").trim().slice(0, 120);
    const role = String(body.role || "").trim().slice(0, 40);
    const label = String(body.label || "").trim().slice(0, 250);
    const payload = JSON.stringify(body.payload || {});
    await sql`
      INSERT INTO ops_events (created_at, device_id, role, event_type, label, payload)
      VALUES (${createdAt}, ${deviceId}, ${role}, ${eventType}, ${label}, ${payload}::jsonb)
    `;
    return Response.json({ ok: true, createdAt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
