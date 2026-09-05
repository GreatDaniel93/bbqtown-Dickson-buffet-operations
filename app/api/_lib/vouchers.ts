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
      status text NOT NULL DEFAULT 'issued',
      claim_key text,
      issued_at timestamptz NOT NULL DEFAULT now(),
      redeemed_at timestamptz,
      redeemed_by text
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS street_vouchers_lookup_idx ON street_vouchers (code, voucher_date, status)`;
  return sql;
}
