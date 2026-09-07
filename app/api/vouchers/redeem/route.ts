import { authorized } from "../../_lib/admin-auth";
import { ensureVoucherSchema } from "../../_lib/vouchers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Staff sign-in required" }, { status: 401 });
  const { code, staff } = await request.json() as { code?: string; staff?: string };
  const clean = String(code || "").trim().toUpperCase();
  if (!/^BT10-[A-F0-9]{8}$/.test(clean)) return Response.json({ error: "Invalid voucher code" }, { status: 400 });
  try {
    const sql = await ensureVoucherSchema();
    const [row] = await sql`
      UPDATE street_vouchers
      SET status = 'redeemed', redeemed_at = now(), redeemed_by = ${String(staff || "Staff")}
      WHERE code = ${clean} AND expires_at > now() AND status = 'issued'
      RETURNING code, discount_percent, expires_at, redeemed_at
    `;
    if (!row) return Response.json({ error: "Voucher is invalid, expired, or already redeemed" }, { status: 409 });
    return Response.json({ ok: true, code: row.code, discountPercent: row.discount_percent, expiresAt: row.expires_at, redeemedAt: row.redeemed_at });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to redeem voucher" }, { status: 500 });
  }
}
