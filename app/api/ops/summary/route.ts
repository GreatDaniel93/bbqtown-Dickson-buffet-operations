import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = await ensureOpsSchema();
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const [deviceStats] = await sql`
      SELECT
        count(*)::int AS total_devices,
        count(*) FILTER (WHERE ${now} - last_seen < 90000)::int AS online_devices,
        coalesce(sum(pending_tasks), 0)::int AS pending_tasks
      FROM ops_devices
    `;
    const eventStats = await sql`
      SELECT event_type, count(*)::int AS count
      FROM ops_events
      WHERE created_at >= ${dayAgo}
      GROUP BY event_type
      ORDER BY count DESC
    `;
    const recent = await sql`
      SELECT created_at, device_id, role, event_type, label
      FROM ops_events
      ORDER BY created_at DESC
      LIMIT 25
    `;
    return Response.json({
      now,
      devices: deviceStats,
      eventCounts24h: eventStats,
      recent: recent.map((row) => ({ ...row, created_at: Number(row.created_at) })),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
