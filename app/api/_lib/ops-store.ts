import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sqlClient: NeonQueryFunction<false, false> | null = null;
let sqlClientUrl = "";

export function getOpsSql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (!sqlClient || sqlClientUrl !== url) {
    sqlClient = neon(url);
    sqlClientUrl = url;
  }
  return sqlClient;
}

let schemaReady: Promise<void> | null = null;
let maintenanceAt = 0;

export async function ensureOpsSchema(): Promise<NeonQueryFunction<false, false>> {
  const sql = getOpsSql();
  if (!schemaReady) {
    schemaReady = (async () => {
      const [probe] = await sql`
        SELECT
          to_regclass('public.ops_devices') AS core,
          to_regclass('public.kitchen_prep_items') AS prep,
          to_regclass('public.buffet_state') AS legacy_buffet,
          to_regclass('public.buffet_service') AS live_service,
          to_regclass('public.buffet_foods') AS live_foods,
          to_regclass('public.buffet_events') AS live_events,
          to_regclass('public.buffet_foods_kitchen_idx') AS live_marker,
          to_regclass('public.kitchen_prep_lookup_idx') AS prep_marker,
          to_regclass('public.ops_devices_refresh_idx') AS device_security_marker,
          to_regclass('public.ops_mutations_created_idx') AS mutation_marker,
          to_regclass('public.buffet_event_daily') AS archive_marker
      `;
      if (
        probe?.core &&
        probe?.prep &&
        probe?.legacy_buffet &&
        probe?.live_service &&
        probe?.live_foods &&
        probe?.live_events &&
        probe?.live_marker &&
        probe?.prep_marker &&
        probe?.device_security_marker &&
        probe?.mutation_marker &&
        probe?.archive_marker
      ) return;

      const now = Date.now();
      await sql.transaction([
        sql`CREATE TABLE IF NOT EXISTS ops_devices (device_id text PRIMARY KEY, role text NOT NULL, app_version text NOT NULL DEFAULT '', pending_tasks integer NOT NULL DEFAULT 0, online boolean NOT NULL DEFAULT true, last_seen bigint NOT NULL, meta jsonb NOT NULL DEFAULT '{}'::jsonb)`,
        sql`ALTER TABLE ops_devices ADD COLUMN IF NOT EXISTS device_name text NOT NULL DEFAULT ''`,
        sql`ALTER TABLE ops_devices ADD COLUMN IF NOT EXISTS refresh_token_hash text NOT NULL DEFAULT ''`,
        sql`ALTER TABLE ops_devices ADD COLUMN IF NOT EXISTS revoked boolean NOT NULL DEFAULT false`,
        sql`ALTER TABLE ops_devices ADD COLUMN IF NOT EXISTS paired_at bigint`,
        sql`CREATE TABLE IF NOT EXISTS ops_events (id bigserial PRIMARY KEY, created_at bigint NOT NULL, device_id text NOT NULL DEFAULT '', role text NOT NULL DEFAULT '', event_type text NOT NULL, label text NOT NULL DEFAULT '', payload jsonb NOT NULL DEFAULT '{}'::jsonb)`,
        sql`CREATE TABLE IF NOT EXISTS ops_checklists (id bigserial PRIMARY KEY, service_date text NOT NULL, checklist_type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at bigint NOT NULL, UNIQUE(service_date, checklist_type))`,
        sql`CREATE TABLE IF NOT EXISTS ops_settings (setting_key text PRIMARY KEY, setting_value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at bigint NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS food_safety_logs (id bigserial PRIMARY KEY, created_at bigint NOT NULL, log_type text NOT NULL, item text NOT NULL, reading text NOT NULL DEFAULT '', unit text NOT NULL DEFAULT '', result text NOT NULL DEFAULT 'PASS', corrective_action text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', device_id text NOT NULL DEFAULT '', role text NOT NULL DEFAULT '')`,
        sql`CREATE TABLE IF NOT EXISTS food_safety_daily (service_date text PRIMARY KEY, payload jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at bigint NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS ops_incidents (id bigserial PRIMARY KEY, created_at bigint NOT NULL, updated_at bigint NOT NULL, category text NOT NULL, severity text NOT NULL DEFAULT 'normal', title text NOT NULL, details text NOT NULL DEFAULT '', action_taken text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'OPEN', owner text NOT NULL DEFAULT '', due_at bigint, closed_at bigint)`,
        sql`CREATE TABLE IF NOT EXISTS ops_handovers (id bigserial PRIMARY KEY, service_date text NOT NULL, shift text NOT NULL, created_at bigint NOT NULL, created_by text NOT NULL DEFAULT '', stock_notes text NOT NULL DEFAULT '', maintenance_notes text NOT NULL DEFAULT '', food_safety_notes text NOT NULL DEFAULT '', staff_notes text NOT NULL DEFAULT '', cleaning_notes text NOT NULL DEFAULT '', next_shift_notes text NOT NULL DEFAULT '')`,
        sql`CREATE TABLE IF NOT EXISTS compliance_documents (id bigserial PRIMARY KEY, document_type text NOT NULL, title text NOT NULL, reference text NOT NULL DEFAULT '', issue_date text NOT NULL DEFAULT '', expiry_date text NOT NULL DEFAULT '', review_date text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', updated_at bigint NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS ops_routines (id bigserial PRIMARY KEY, task_key text UNIQUE NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '', category text NOT NULL DEFAULT 'OPERATIONS', frequency text NOT NULL DEFAULT 'DAILY', active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0)`,
        sql`CREATE TABLE IF NOT EXISTS ops_routine_logs (id bigserial PRIMARY KEY, routine_id bigint NOT NULL REFERENCES ops_routines(id) ON DELETE CASCADE, service_date text NOT NULL, completed_at bigint NOT NULL, completed_by text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', UNIQUE(routine_id,service_date))`,
        sql`CREATE TABLE IF NOT EXISTS ops_automation_keys (automation_key text PRIMARY KEY, incident_id bigint, state text NOT NULL DEFAULT 'OPEN', created_at bigint NOT NULL, updated_at bigint NOT NULL)`,
        sql`CREATE TABLE IF NOT EXISTS kitchen_prep_items (id bigserial PRIMARY KEY, prep_date text NOT NULL, section text NOT NULL DEFAULT 'ALL', item text NOT NULL, quantity text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', sort_order integer NOT NULL DEFAULT 0, created_at bigint NOT NULL, created_by text NOT NULL DEFAULT '', completed boolean NOT NULL DEFAULT false, completed_at bigint, completed_by text NOT NULL DEFAULT '')`,
        sql`CREATE TABLE IF NOT EXISTS ops_mutations (mutation_id text PRIMARY KEY, created_at bigint NOT NULL, device_id text NOT NULL DEFAULT '', response_version bigint NOT NULL DEFAULT 0)`,

        sql`CREATE TABLE IF NOT EXISTS buffet_state (id integer PRIMARY KEY, payload jsonb NOT NULL, updated_at bigint NOT NULL, CONSTRAINT buffet_state_singleton CHECK (id = 1))`,
        sql`CREATE TABLE IF NOT EXISTS buffet_service (
          id integer PRIMARY KEY,
          version bigint NOT NULL DEFAULT 0,
          is_open boolean NOT NULL DEFAULT false,
          mutation_token text NOT NULL DEFAULT '',
          updated_at bigint NOT NULL,
          CONSTRAINT buffet_service_singleton CHECK (id = 1)
        )`,
        sql`CREATE TABLE IF NOT EXISTS buffet_foods (
          id bigserial PRIMARY KEY,
          name text NOT NULL,
          category text NOT NULL DEFAULT 'Other',
          section integer NOT NULL DEFAULT 1,
          status text NOT NULL DEFAULT 'GOOD',
          kitchen text NOT NULL DEFAULT 'idle',
          start_at bigint NOT NULL DEFAULT 0,
          requested_at bigint,
          preparing_at bigint,
          ready_at bigint,
          stopped_at bigint,
          closed_at bigint,
          sort_order integer NOT NULL DEFAULT 0,
          active boolean NOT NULL DEFAULT true,
          updated_at bigint NOT NULL
        )`,
        sql`CREATE TABLE IF NOT EXISTS buffet_events (
          id bigserial PRIMARY KEY,
          created_at bigint NOT NULL,
          action text NOT NULL,
          food_id bigint,
          food_name text NOT NULL DEFAULT 'Store',
          section_label text NOT NULL DEFAULT 'All Sections',
          detail text NOT NULL DEFAULT '',
          meta jsonb NOT NULL DEFAULT '{}'::jsonb
        )`,
        sql`CREATE TABLE IF NOT EXISTS buffet_event_daily (
          service_date text NOT NULL,
          action text NOT NULL,
          section_label text NOT NULL DEFAULT 'All Sections',
          event_count integer NOT NULL DEFAULT 0,
          first_at bigint NOT NULL,
          last_at bigint NOT NULL,
          PRIMARY KEY(service_date, action, section_label)
        )`,

        sql`CREATE INDEX IF NOT EXISTS ops_events_created_at_idx ON ops_events (created_at DESC)`,
        sql`CREATE INDEX IF NOT EXISTS ops_events_type_idx ON ops_events (event_type, created_at DESC)`,
        sql`CREATE INDEX IF NOT EXISTS ops_devices_refresh_idx ON ops_devices (refresh_token_hash) WHERE refresh_token_hash <> ''`,
        sql`CREATE INDEX IF NOT EXISTS ops_devices_seen_idx ON ops_devices (last_seen DESC)`,
        sql`CREATE INDEX IF NOT EXISTS ops_mutations_created_idx ON ops_mutations (created_at DESC)`,
        sql`CREATE INDEX IF NOT EXISTS food_safety_created_at_idx ON food_safety_logs (created_at DESC)`,
        sql`CREATE INDEX IF NOT EXISTS food_safety_type_idx ON food_safety_logs (log_type, created_at DESC)`,
        sql`CREATE INDEX IF NOT EXISTS ops_incidents_status_idx ON ops_incidents (status, updated_at DESC)`,
        sql`CREATE INDEX IF NOT EXISTS ops_handovers_date_idx ON ops_handovers (service_date DESC, created_at DESC)`,
        sql`CREATE INDEX IF NOT EXISTS compliance_documents_expiry_idx ON compliance_documents (expiry_date)`,
        sql`CREATE INDEX IF NOT EXISTS ops_routine_logs_date_idx ON ops_routine_logs (service_date DESC, completed_at DESC)`,
        sql`CREATE INDEX IF NOT EXISTS kitchen_prep_date_idx ON kitchen_prep_items (prep_date, section, completed, sort_order, id)`,
        sql`CREATE INDEX IF NOT EXISTS kitchen_prep_lookup_idx ON kitchen_prep_items (prep_date, section, lower(item))`,
        sql`CREATE INDEX IF NOT EXISTS buffet_foods_active_section_idx ON buffet_foods (active, section, sort_order, id)`,
        sql`CREATE INDEX IF NOT EXISTS buffet_foods_kitchen_idx ON buffet_foods (kitchen, section, active)`,
        sql`CREATE INDEX IF NOT EXISTS buffet_events_created_at_idx ON buffet_events (created_at DESC, id DESC)`,

        sql`INSERT INTO buffet_service (id, version, is_open, mutation_token, updated_at)
            SELECT 1, COALESCE((SELECT updated_at FROM buffet_state WHERE id=1), 0), false, '', ${now}
            ON CONFLICT (id) DO NOTHING`,

        sql`INSERT INTO buffet_foods (
              id, name, category, section, status, kitchen, start_at,
              requested_at, preparing_at, ready_at, stopped_at, closed_at,
              sort_order, active, updated_at
            )
            SELECT
              COALESCE(NULLIF(food->>'id','')::bigint, ord::bigint),
              COALESCE(NULLIF(food->>'name',''), 'Untitled'),
              COALESCE(NULLIF(food->>'category',''), 'Other'),
              CASE WHEN COALESCE(food->>'section','1') = '2' THEN 2 ELSE 1 END,
              COALESCE(NULLIF(upper(food->>'status'),''), 'GOOD'),
              COALESCE(NULLIF(lower(food->>'kitchen'),''), 'idle'),
              COALESCE(NULLIF(food->>'start','')::bigint, 0),
              NULLIF(food->>'requestedAt','')::bigint,
              NULLIF(food->>'preparingAt','')::bigint,
              NULLIF(food->>'readyAt','')::bigint,
              NULLIF(food->>'stoppedAt','')::bigint,
              NULLIF(food->>'closedAt','')::bigint,
              (ord - 1)::integer,
              true,
              legacy.updated_at
            FROM buffet_state legacy
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(legacy.payload->'foods', '[]'::jsonb)) WITH ORDINALITY AS x(food, ord)
            WHERE legacy.id=1
              AND NOT EXISTS (SELECT 1 FROM buffet_foods)`,

        sql`SELECT setval(
              pg_get_serial_sequence('buffet_foods','id'),
              GREATEST(COALESCE((SELECT MAX(id) FROM buffet_foods), 1), 1),
              true
            )`,

        sql`INSERT INTO buffet_events (created_at, action, food_name, section_label, detail)
            SELECT
              COALESCE(NULLIF(entry->>'at','')::bigint, legacy.updated_at),
              COALESCE(NULLIF(entry->>'action',''), 'MIGRATED EVENT'),
              COALESCE(NULLIF(entry->>'food',''), 'Store'),
              COALESCE(NULLIF(entry->>'section',''), 'All Sections'),
              COALESCE(entry->>'detail','')
            FROM buffet_state legacy
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(legacy.payload->'logs', '[]'::jsonb)) WITH ORDINALITY AS x(entry, ord)
            WHERE legacy.id=1
              AND NOT EXISTS (SELECT 1 FROM buffet_events)
            ORDER BY ord
            LIMIT 200`,

        sql`UPDATE buffet_service
            SET is_open = EXISTS (SELECT 1 FROM buffet_foods WHERE active AND status <> 'CLOSED'),
                version = GREATEST(version, COALESCE((SELECT updated_at FROM buffet_state WHERE id=1), version)),
                updated_at = ${now}
            WHERE id=1`,
      ]);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
  return sql;
}

export async function runOpsMaintenance(sql: NeonQueryFunction<false, false>) {
  const now = Date.now();
  if (now - maintenanceAt < 6 * 60 * 60 * 1000) return;
  maintenanceAt = now;
  const eventCutoff = now - 90 * 24 * 60 * 60 * 1000;
  const mutationCutoff = now - 14 * 24 * 60 * 60 * 1000;
  try {
    await sql.transaction([
      sql`INSERT INTO buffet_event_daily(service_date,action,section_label,event_count,first_at,last_at)
          SELECT
            to_char(to_timestamp(created_at/1000.0) AT TIME ZONE 'Australia/Sydney','YYYY-MM-DD'),
            action,
            section_label,
            COUNT(*)::integer,
            MIN(created_at),
            MAX(created_at)
          FROM buffet_events
          WHERE created_at < ${eventCutoff}
          GROUP BY 1,2,3
          ON CONFLICT(service_date,action,section_label) DO UPDATE SET
            event_count=buffet_event_daily.event_count+EXCLUDED.event_count,
            first_at=LEAST(buffet_event_daily.first_at,EXCLUDED.first_at),
            last_at=GREATEST(buffet_event_daily.last_at,EXCLUDED.last_at)`,
      sql`DELETE FROM buffet_events WHERE created_at < ${eventCutoff}`,
      sql`DELETE FROM ops_mutations WHERE created_at < ${mutationCutoff}`,
    ]);
  } catch (error) {
    maintenanceAt = 0;
    console.error("ops maintenance failed", error);
  }
}
