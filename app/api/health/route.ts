import { ensureOpsSchema } from "../_lib/ops-store";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export async function GET(request: Request) {
  try {
    const sql = await ensureOpsSchema();
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);
    const since = Number(url.searchParams.get("since") || 0);
    const rows = since > 0
      ? await sql`SELECT * FROM food_safety_logs WHERE created_at >= ${since} ORDER BY created_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM food_safety_logs ORDER BY created_at DESC LIMIT ${limit}`;
    const today = new Date().toISOString().slice(0, 10);
    const [daily] = await sql`SELECT payload, updated_at FROM food_safety_daily WHERE service_date = ${today}`;
    return Response.json({ logs: rows, daily: daily?.payload ?? null, dailyUpdatedAt: Number(daily?.updated_at || 0) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sql = await ensureOpsSchema();
    const action = clean(body.action, 40);

    if (action === "daily") {
      const serviceDate = clean(body.serviceDate, 20) || new Date().toISOString().slice(0, 10);
      const payload = JSON.stringify(body.payload ?? {});
      const updatedAt = Date.now();
      await sql`
        INSERT INTO food_safety_daily (service_date, payload, updated_at)
        VALUES (${serviceDate}, ${payload}::jsonb, ${updatedAt})
        ON CONFLICT (service_date) DO UPDATE
        SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
      `;
      return Response.json({ ok: true, updatedAt });
    }

    const logType = clean(body.logType, 80);
    const item = clean(body.item, 180);
    if (!logType || !item) return Response.json({ error: "logType and item are required" }, { status: 400 });

    const createdAt = Date.now();
    const reading = clean(body.reading, 80);
    const unit = clean(body.unit, 20);
    const result = clean(body.result, 20) || "PASS";
    const correctiveAction = clean(body.correctiveAction, 600);
    const notes = clean(body.notes, 1000);
    const deviceId = clean(body.deviceId, 120);
    const role = clean(body.role, 60);

    await sql`
      INSERT INTO food_safety_logs
        (created_at, log_type, item, reading, unit, result, corrective_action, notes, device_id, role)
      VALUES
        (${createdAt}, ${logType}, ${item}, ${reading}, ${unit}, ${result}, ${correctiveAction}, ${notes}, ${deviceId}, ${role})
    `;
    return Response.json({ ok: true, createdAt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
