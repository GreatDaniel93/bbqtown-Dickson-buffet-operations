import { cookies } from "next/headers";
import { ensureVoucherSchema, makeVoucherCode, voucherDate } from "../../_lib/vouchers";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const jar = await cookies();
    const key = jar.get("bbqtown_voucher_key")?.value || crypto.randomUUID();
    const date = voucherDate();
    const sql = await ensureVoucherSchema();
    const [existing] = await sql`
      SELECT code, voucher_date, issued_at, expires_at, discount_percent
      FROM street_vouchers
      WHERE claim_key = ${key} AND status = 'issued' AND expires_at > now()
      ORDER BY issued_at DESC
      LIMIT 1
    `;
    let voucher = existing;
    if (!voucher) {
      const candidate = makeVoucherCode();
      const [created] = await sql`
        WITH daily_lock AS (SELECT pg_advisory_xact_lock(hashtext(${date}))),
        issued AS (SELECT count(*)::int AS count FROM street_vouchers, daily_lock WHERE voucher_date = ${date})
        INSERT INTO street_vouchers (code, voucher_date, claim_key, discount_percent, expires_at)
        SELECT ${candidate}, ${date}, ${key}, 10, now() + interval '14 days' FROM issued WHERE count < 100
        RETURNING code, voucher_date, issued_at, expires_at, discount_percent
      `;
      if (!created) return Response.json({ error: "All 100 street vouchers for today have been claimed. Please try again tomorrow." }, { status: 429 });
      voucher = created;
    }
    const response = Response.json({
      code: voucher.code,
      issuedAt: voucher.issued_at,
      expiresAt: voucher.expires_at,
      discountPercent: voucher.discount_percent,
      status: "issued",
    });
    response.headers.set("Set-Cookie", `bbqtown_voucher_key=${key}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600`);
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to issue voucher" }, { status: 500 });
  }
}
