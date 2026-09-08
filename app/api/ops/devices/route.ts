import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = await ensureOpsSchema();
    const now = Date.now();
    const rows = await sql`
      SELECT device_id, role, app_version, pending_tasks, online, last_seen, meta
      FROM ops_devices
      ORDER BY last_seen DESC
    `;
    const devices = rows.map((row) => ({
      ...row,
      last_seen: Number(row.last_seen),
      healthy: now - Number(row.last_seen) < 90_000,
    }));
    return Response.json({ devices, now });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      deviceId?: string;
      role?: string;
      appVersion?: string;
      pendingTasks?: number;
      online?: boolean;
      meta?: Record<string, unknown>;
    };
    const deviceId = String(body.deviceId || "").trim().slice(0, 120);
    const role = String(body.role || "unknown").trim().slice(0, 40);
    const appVersion = String(body.appVersion || "").trim().slice(0, 40);
    const pendingTasks = Number.isFinite(body.pendingTasks) ? Math.max(0, Math.min(999, Math.floor(body.pendingTasks!))) : 0;
    if (!deviceId) return Response.json({ error: "deviceId is required" }, { status: 400 });
    const sql = await ensureOpsSchema();
    const lastSeen = Date.now();
    const meta = JSON.stringify(body.meta || {});
    await sql`
      INSERT INTO ops_devices (device_id, role, app_version, pending_tasks, online, last_seen, meta)
      VALUES (${deviceId}, ${role}, ${appVersion}, ${pendingTasks}, ${body.online !== false}, ${lastSeen}, ${meta}::jsonb)
      ON CONFLICT (device_id) DO UPDATE SET
        role = EXCLUDED.role,
        app_version = EXCLUDED.app_version,
        pending_tasks = EXCLUDED.pending_tasks,
        online = EXCLUDED.online,
        last_seen = EXCLUDED.last_seen,
        meta = EXCLUDED.meta
    `;
    return Response.json({ ok: true, lastSeen });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
