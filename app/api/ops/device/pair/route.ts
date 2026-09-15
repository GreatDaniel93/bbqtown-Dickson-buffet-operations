import { verifyPin } from "../../../_lib/admin-auth";
import { createDeviceAccessToken, hashRefreshToken, newRefreshToken } from "../../../_lib/device-auth";
import { ensureOpsSchema } from "../../../_lib/ops-store";

export const dynamic = "force-dynamic";

const clean = (value: unknown, max = 120) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pin = clean(body.pin, 40);
    if (!verifyPin(pin)) return Response.json({ error: "Incorrect Manager PIN" }, { status: 401 });

    const deviceId = clean(body.deviceId, 120);
    const deviceName = clean(body.deviceName, 120) || "BBQ Town tablet";
    const role = clean(body.role, 40) || "unassigned";
    const appVersion = clean(body.appVersion, 40);
    if (!deviceId) return Response.json({ error: "deviceId is required" }, { status: 400 });

    const sql = await ensureOpsSchema();
    const now = Date.now();
    const refreshToken = newRefreshToken();
    const refreshHash = hashRefreshToken(refreshToken);
    const meta = JSON.stringify({ pairedBy: "manager-pin" });

    await sql`
      INSERT INTO ops_devices
        (device_id, device_name, role, app_version, pending_tasks, online, last_seen, meta, refresh_token_hash, revoked, paired_at)
      VALUES
        (${deviceId}, ${deviceName}, ${role}, ${appVersion}, 0, true, ${now}, ${meta}::jsonb, ${refreshHash}, false, ${now})
      ON CONFLICT (device_id) DO UPDATE SET
        device_name=EXCLUDED.device_name,
        role=EXCLUDED.role,
        app_version=EXCLUDED.app_version,
        online=true,
        last_seen=EXCLUDED.last_seen,
        refresh_token_hash=EXCLUDED.refresh_token_hash,
        revoked=false,
        paired_at=EXCLUDED.paired_at,
        meta=ops_devices.meta || EXCLUDED.meta
    `;

    const access = createDeviceAccessToken(deviceId, role, now);
    return Response.json({
      ok: true,
      deviceId,
      refreshToken,
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
    });
  } catch (error) {
    console.error("device pairing failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Pairing failed" }, { status: 500 });
  }
}
