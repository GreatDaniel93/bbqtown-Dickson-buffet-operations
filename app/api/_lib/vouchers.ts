import { randomBytes } from "node:crypto";
import { getSql } from "./reservations";

export function voucherDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function makeVoucherCode() {
  return `BT10-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function ensureVoucherSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS street_vouchers (
      id bigserial PRIMARY KEY,
      code text UNIQUE NOT NULL,
      voucher_date date NOT NULL,
      amount_cents integer NOT NULL DEFAULT 1000,
      discount_percent integer NOT NULL DEFAULT 10,
      status text NOT NULL DEFAULT 'issued',
      claim_key text,
      issued_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
      redeemed_at timestamptz,
      redeemed_by text
    )
  `;
  await sql`ALTER TABLE street_vouchers ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 10`;
  await sql`ALTER TABLE street_vouchers ADD COLUMN IF NOT EXISTS expires_at timestamptz`;
  await sql`UPDATE street_vouchers SET expires_at = issued_at + interval '14 days' WHERE expires_at IS NULL`;
  await sql`ALTER TABLE street_vouchers ALTER COLUMN expires_at SET DEFAULT (now() + interval '14 days')`;
  await sql`ALTER TABLE street_vouchers ALTER COLUMN expires_at SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS street_vouchers_active_idx ON street_vouchers (code, status, expires_at)`;
  return sql;
}
