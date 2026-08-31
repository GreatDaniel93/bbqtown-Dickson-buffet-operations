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
    CREATE TABLE IF NOT EXISTS buffet_state (
      id integer PRIMARY KEY,
      payload jsonb NOT NULL,
      updated_at bigint NOT NULL,
      CONSTRAINT buffet_state_singleton CHECK (id = 1)
    )
  `;
  return sql;
}

export async function GET() {
  try {
    const sql = await ensureSchema();
    const [row] = await sql`SELECT payload, updated_at FROM buffet_state WHERE id = 1`;
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
    const body = (await request.json()) as { foods?: unknown[]; logs?: unknown[] };
    if (!Array.isArray(body.foods) || body.foods.length !== 56 || !Array.isArray(body.logs)) {
      return Response.json({ error: "Invalid buffet state" }, { status: 400 });
    }
    const updatedAt = Date.now();
    const payload = JSON.stringify({ foods: body.foods, logs: body.logs.slice(0, 1000) });
    const sql = await ensureSchema();
    await sql`
      INSERT INTO buffet_state (id, payload, updated_at)
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
