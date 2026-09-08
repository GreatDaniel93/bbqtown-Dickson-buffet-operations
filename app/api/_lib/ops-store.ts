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
    CREATE TABLE IF NOT EXISTS ops_checklists (
      id bigserial PRIMARY KEY,
      service_date text NOT NULL,
      checklist_type text NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at bigint NOT NULL,
      UNIQUE(service_date, checklist_type)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ops_settings (
      setting_key text PRIMARY KEY,
      setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at bigint NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS food_safety_logs (
      id bigserial PRIMARY KEY,
      created_at bigint NOT NULL,
      log_type text NOT NULL,
      item text NOT NULL,
      reading text NOT NULL DEFAULT '',
      unit text NOT NULL DEFAULT '',
      result text NOT NULL DEFAULT 'PASS',
      corrective_action text NOT NULL DEFAULT '',
      notes text NOT NULL DEFAULT '',
      device_id text NOT NULL DEFAULT '',
      role text NOT NULL DEFAULT ''
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS food_safety_daily (
      service_date text PRIMARY KEY,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at bigint NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ops_events_created_at_idx ON ops_events (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ops_events_type_idx ON ops_events (event_type, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS food_safety_created_at_idx ON food_safety_logs (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS food_safety_type_idx ON food_safety_logs (log_type, created_at DESC)`;
  return sql;
}
