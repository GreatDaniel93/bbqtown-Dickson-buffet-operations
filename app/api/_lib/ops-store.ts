import { neon } from "@neondatabase/serverless";

export function getOpsSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

export async function ensureOpsSchema() {
  const sql = getOpsSql();
  await sql`CREATE TABLE IF NOT EXISTS ops_devices (device_id text PRIMARY KEY, role text NOT NULL, app_version text NOT NULL DEFAULT '', pending_tasks integer NOT NULL DEFAULT 0, online boolean NOT NULL DEFAULT true, last_seen bigint NOT NULL, meta jsonb NOT NULL DEFAULT '{}'::jsonb)`;
  await sql`CREATE TABLE IF NOT EXISTS ops_events (id bigserial PRIMARY KEY, created_at bigint NOT NULL, device_id text NOT NULL DEFAULT '', role text NOT NULL DEFAULT '', event_type text NOT NULL, label text NOT NULL DEFAULT '', payload jsonb NOT NULL DEFAULT '{}'::jsonb)`;
  await sql`CREATE TABLE IF NOT EXISTS ops_checklists (id bigserial PRIMARY KEY, service_date text NOT NULL, checklist_type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at bigint NOT NULL, UNIQUE(service_date, checklist_type))`;
  await sql`CREATE TABLE IF NOT EXISTS ops_settings (setting_key text PRIMARY KEY, setting_value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at bigint NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS food_safety_logs (id bigserial PRIMARY KEY, created_at bigint NOT NULL, log_type text NOT NULL, item text NOT NULL, reading text NOT NULL DEFAULT '', unit text NOT NULL DEFAULT '', result text NOT NULL DEFAULT 'PASS', corrective_action text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', device_id text NOT NULL DEFAULT '', role text NOT NULL DEFAULT '')`;
  await sql`CREATE TABLE IF NOT EXISTS food_safety_daily (service_date text PRIMARY KEY, payload jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at bigint NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ops_incidents (id bigserial PRIMARY KEY, created_at bigint NOT NULL, updated_at bigint NOT NULL, category text NOT NULL, severity text NOT NULL DEFAULT 'normal', title text NOT NULL, details text NOT NULL DEFAULT '', action_taken text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'OPEN', owner text NOT NULL DEFAULT '', due_at bigint, closed_at bigint)`;
  await sql`CREATE TABLE IF NOT EXISTS ops_handovers (id bigserial PRIMARY KEY, service_date text NOT NULL, shift text NOT NULL, created_at bigint NOT NULL, created_by text NOT NULL DEFAULT '', stock_notes text NOT NULL DEFAULT '', maintenance_notes text NOT NULL DEFAULT '', food_safety_notes text NOT NULL DEFAULT '', staff_notes text NOT NULL DEFAULT '', cleaning_notes text NOT NULL DEFAULT '', next_shift_notes text NOT NULL DEFAULT '')`;
  await sql`CREATE TABLE IF NOT EXISTS compliance_documents (id bigserial PRIMARY KEY, document_type text NOT NULL, title text NOT NULL, reference text NOT NULL DEFAULT '', issue_date text NOT NULL DEFAULT '', expiry_date text NOT NULL DEFAULT '', review_date text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', updated_at bigint NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS ops_routines (id bigserial PRIMARY KEY, task_key text UNIQUE NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '', category text NOT NULL DEFAULT 'OPERATIONS', frequency text NOT NULL DEFAULT 'DAILY', active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0)`;
  await sql`CREATE TABLE IF NOT EXISTS ops_routine_logs (id bigserial PRIMARY KEY, routine_id bigint NOT NULL REFERENCES ops_routines(id) ON DELETE CASCADE, service_date text NOT NULL, completed_at bigint NOT NULL, completed_by text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', UNIQUE(routine_id,service_date))`;
  await sql`CREATE TABLE IF NOT EXISTS ops_automation_keys (automation_key text PRIMARY KEY, incident_id bigint, state text NOT NULL DEFAULT 'OPEN', created_at bigint NOT NULL, updated_at bigint NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS kitchen_prep_items (id bigserial PRIMARY KEY, prep_date text NOT NULL, section text NOT NULL DEFAULT 'ALL', item text NOT NULL, quantity text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', sort_order integer NOT NULL DEFAULT 0, created_at bigint NOT NULL, created_by text NOT NULL DEFAULT '', completed boolean NOT NULL DEFAULT false, completed_at bigint, completed_by text NOT NULL DEFAULT '')`;
  await sql`CREATE INDEX IF NOT EXISTS ops_events_created_at_idx ON ops_events (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ops_events_type_idx ON ops_events (event_type, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS food_safety_created_at_idx ON food_safety_logs (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS food_safety_type_idx ON food_safety_logs (log_type, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ops_incidents_status_idx ON ops_incidents (status, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ops_handovers_date_idx ON ops_handovers (service_date DESC, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS compliance_documents_expiry_idx ON compliance_documents (expiry_date)`;
  await sql`CREATE INDEX IF NOT EXISTS ops_routine_logs_date_idx ON ops_routine_logs (service_date DESC, completed_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS kitchen_prep_date_idx ON kitchen_prep_items (prep_date, section, completed, sort_order, id)`;
  return sql;
}
