import { authorized } from "../../_lib/admin-auth";
import { createDeviceAccessToken, hashRefreshToken } from "../../_lib/device-auth";
import { ensureOpsSchema, runOpsMaintenance } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";
const clean = (v: unknown, n = 120) => String(v ?? "").trim().slice(0, n);

export async function GET() {
  try {
    const sql = await ensureOpsSchema();
    const now = Date.now();
    const rows = await sql`
      SELECT device_id, device_name, role, app_version, pending_tasks, online, last_seen, meta, revoked, paired_at
      FROM ops_devices
      ORDER BY last_seen DESC
    `;
    const devices = rows.map((row) => ({
      ...row,
      last_seen: Number(row.last_seen),
      paired_at: Number(row.paired_at || 0),
      healthy: !row.revoked && now - Number(row.last_seen) < 120_000,
    }));
    return Response.json({ devices, now });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = clean(body.action, 40);
    const sql = await ensureOpsSchema();

    if (action === "revoke" || action === "restore") {
      if (!authorized(request)) return Response.json({ error: "Manager authentication required" }, { status: 401 });
      const deviceId = clean(body.deviceId, 120);
      if (!deviceId) return Response.json({ error: "deviceId is required" }, { status: 400 });
      const revoked = action === "revoke";
      await sql`UPDATE ops_devices SET revoked=${revoked}, online=${!revoked} WHERE device_id=${deviceId}`;
      return Response.json({ ok: true, deviceId, revoked });
    }

    const deviceId = clean(body.deviceId, 120);
    const refreshToken = clean(request.headers.get("x-bbqtown-refresh-token"), 256);
    if (!deviceId || !refreshToken) return Response.json({ error: "Device refresh credentials required" }, { status: 401 });

    const refreshHash = hashRefreshToken(refreshToken);
    const [device] = await sql`
      SELECT device_id, role, revoked
      FROM ops_devices
      WHERE device_id=${deviceId} AND refresh_token_hash=${refreshHash}
      LIMIT 1
    `;
    if (!device || device.revoked) return Response.json({ error: "Device is not paired or has been revoked" }, { status: 401 });

    const role = clean(body.role, 40) || clean(device.role, 40) || "unknown";
    const appVersion = clean(body.appVersion, 40);
    const deviceName = clean(body.deviceName, 120);
    const pendingTasks = Number.isFinite(body.pendingTasks) ? Math.max(0, Math.min(999, Math.floor(body.pendingTasks))) : 0;
    const now = Date.now();
    const meta = JSON.stringify(body.meta || {});

    await sql`
      UPDATE ops_devices SET
        device_name=CASE WHEN ${deviceName}='' THEN device_name ELSE ${deviceName} END,
        role=${role},
        app_version=${appVersion},
        pending_tasks=${pendingTasks},
        online=true,
        last_seen=${now},
        meta=meta || ${meta}::jsonb
      WHERE device_id=${deviceId}
    `;

    void runOpsMaintenance(sql);
    const access = createDeviceAccessToken(deviceId, role, now);
    return Response.json({ ok: true, lastSeen: now, accessToken: access.token, accessExpiresAt: access.expiresAt });
  } catch (error) {
    console.error("device heartbeat failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
