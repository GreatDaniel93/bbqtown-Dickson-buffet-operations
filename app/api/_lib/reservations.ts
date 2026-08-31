import { neon } from "@neondatabase/serverless";

export type DayHours = { enabled: boolean; open: string; close: string };
export type BookingSettings = {
  enabled: boolean;
  slotMinutes: number;
  maxCoversPerSlot: number;
  maxPartySize: number;
  bookingWindowDays: number;
  hours: DayHours[];
};

export const defaultSettings: BookingSettings = {
  enabled: false,
  slotMinutes: 30,
  maxCoversPerSlot: 0,
  maxPartySize: 0,
  bookingWindowDays: 60,
  hours: Array.from({ length: 7 }, () => ({ enabled: false, open: "11:30", close: "21:00" })),
};

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

export async function ensureReservationSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS booking_settings (
      id integer PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT booking_settings_singleton CHECK (id = 1)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS reservations (
      id bigserial PRIMARY KEY,
      reference text UNIQUE NOT NULL,
      booking_date date NOT NULL,
      booking_time time NOT NULL,
      party_size integer NOT NULL CHECK (party_size > 0),
      guest_name text NOT NULL,
      phone text NOT NULL,
      email text,
      notes text,
      status text NOT NULL DEFAULT 'confirmed',
      source text NOT NULL DEFAULT 'online',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS reservations_service_idx ON reservations (booking_date, booking_time, status)`;
  return sql;
}

export async function readSettings(): Promise<BookingSettings> {
  const sql = await ensureReservationSchema();
  const [row] = await sql`SELECT payload FROM booking_settings WHERE id = 1`;
  if (!row) return defaultSettings;
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
  return { ...defaultSettings, ...payload } as BookingSettings;
}

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function slotsForDate(settings: BookingSettings, date: string) {
  const day = new Date(`${date}T12:00:00+10:00`).getDay();
  const hours = settings.hours[day];
  if (!settings.enabled || !hours?.enabled) return [];
  const start = minutes(hours.open);
  const end = minutes(hours.close);
  const result: string[] = [];
  for (let value = start; value <= end; value += settings.slotMinutes) {
    result.push(`${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`);
  }
  return result;
}

export function makeReference() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BT-";
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
