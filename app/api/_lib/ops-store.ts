import { neon } from "@neondatabase/serverless";

export function getOpsSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

export async function ensureOpsSchema() {
  const sql = getOpsSql();
  await sql`
    CREATE TABLE IF NOT EXISTS ops_devices (
      device_id text PRIMARY KEY,
      role text NOT NULL,
      app_version text NOT NULL DEFAULT '',
      pending_tasks integer NOT NULL DEFAULT 0,
      online boolean NOT NULL DEFAULT true,
      last_seen bigint NOT NULL,
      meta jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ops_events (
      id bigserial PRIMARY KEY,
      created_at bigint NOT NULL,
      device_id text NOT NULL DEFAULT '',
      role text NOT NULL DEFAULT '',
      event_type text NOT NULL,
      label text NOT NULL DEFAULT '',
      payload jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ops_daily_checklist (
      service_date text NOT NULL,
      shift text NOT NULL,
      item_key text NOT NULL,
      label text NOT NULL,
      completed boolean NOT NULL DEFAULT false,
      completed_at bigint,
      completed_by text NOT NULL DEFAULT '',
      PRIMARY KEY (service_date, shift, item_key)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ops_settings (
      setting_key text PRIMARY KEY,
      setting_value jsonb NOT NULL,
      updated_at bigint NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ops_events_created_at_idx ON ops_events (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ops_events_type_idx ON ops_events (event_type, created_at DESC)`;
  return sql;
}
