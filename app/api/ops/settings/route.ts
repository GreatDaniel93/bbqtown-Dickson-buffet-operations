import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";

const DEFAULT = { mode: "normal", alertRepeatSeconds: 30 };

export async function GET() {
  try {
    const sql = await ensureOpsSchema();
    const [row] = await sql`SELECT setting_value, updated_at FROM ops_settings WHERE setting_key = 'store_mode'`;
    const value = row?.setting_value || DEFAULT;
    return Response.json({ value, updatedAt: row?.updated_at ? Number(row.updated_at) : 0 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { mode?: string; alertRepeatSeconds?: number };
    const mode = ["normal", "busy", "short_staff"].includes(String(body.mode)) ? String(body.mode) : "normal";
    const alertRepeatSeconds = Math.max(15, Math.min(120, Number(body.alertRepeatSeconds || 30)));
    const sql = await ensureOpsSchema();
    const updatedAt = Date.now();
    const value = JSON.stringify({ mode, alertRepeatSeconds });
    await sql`
      INSERT INTO ops_settings (setting_key, setting_value, updated_at)
      VALUES ('store_mode', ${value}::jsonb, ${updatedAt})
      ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = EXCLUDED.updated_at
    `;
    await sql`
      INSERT INTO ops_events (created_at, role, event_type, label, payload)
      VALUES (${updatedAt}, 'manager', 'STORE_MODE', ${mode}, ${value}::jsonb)
    `;
    return Response.json({ ok: true, value: { mode, alertRepeatSeconds }, updatedAt });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
