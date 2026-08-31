import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

async function ensureSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS table_timer_state (
      id integer PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at bigint NOT NULL,
      CONSTRAINT table_timer_state_singleton CHECK (id = 1)
    )
  `;
  return sql;
}

export async function GET() {
  try {
    const sql = await ensureSchema();
    const [row] = await sql`SELECT payload, updated_at FROM table_timer_state WHERE id = 1`;
    if (!row) return Response.json({ state: null, updatedAt: 0 });
    const state = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
    return Response.json({ state, updatedAt: Number(row.updated_at) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Database unavailable" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tables?: unknown[]; logs?: unknown[] };
    if (!Array.isArray(body.tables) || body.tables.length !== 20 || !Array.isArray(body.logs)) {
      return Response.json({ error: "Invalid table timer state" }, { status: 400 });
    }
    const updatedAt = Date.now();
    const payload = JSON.stringify({ tables: body.tables, logs: body.logs.slice(0, 500) });
    const sql = await ensureSchema();
    await sql`
      INSERT INTO table_timer_state (id, payload, updated_at)
      VALUES (1, ${payload}::jsonb, ${updatedAt})
      ON CONFLICT (id) DO UPDATE
      SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
    `;
    return Response.json({ ok: true, updatedAt });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Database unavailable" },
      { status: 500 },
    );
  }
}
