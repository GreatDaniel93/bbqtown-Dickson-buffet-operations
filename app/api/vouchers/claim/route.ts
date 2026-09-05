import { cookies } from "next/headers";
import { ensureVoucherSchema, makeVoucherCode, voucherDate } from "../../_lib/vouchers";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const jar = await cookies();
    const key = jar.get("bbqtown_voucher_key")?.value || crypto.randomUUID();
    const date = voucherDate();
    const sql = await ensureVoucherSchema();
    const [existing] = await sql`SELECT code, voucher_date FROM street_vouchers WHERE claim_key = ${key} AND voucher_date = ${date} LIMIT 1`;
    let code = existing?.code;
    if (!code) {
      const candidate = makeVoucherCode();
      const [created] = await sql`
        WITH daily_lock AS (SELECT pg_advisory_xact_lock(hashtext(${date}))),
        issued AS (SELECT count(*)::int AS count FROM street_vouchers, daily_lock WHERE voucher_date = ${date})
        INSERT INTO street_vouchers (code, voucher_date, claim_key)
        SELECT ${candidate}, ${date}, ${key} FROM issued WHERE count < 100
        RETURNING code
      `;
      if (!created) return Response.json({ error: "All 100 street vouchers for today have been claimed. Please try again tomorrow." }, { status: 429 });
      code = created.code;
    }
    const response = Response.json({ code, date, amount: 10, status: "issued" });
    response.headers.set("Set-Cookie", `bbqtown_voucher_key=${key}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to issue voucher" }, { status: 500 });
  }
}
