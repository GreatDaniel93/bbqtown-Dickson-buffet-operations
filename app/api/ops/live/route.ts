import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";

type Sql = Awaited<ReturnType<typeof ensureOpsSchema>>;

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function readState(sql: Sql) {
  const [row] = await sql`
    SELECT
      service.version,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', food.id,
            'name', food.name,
            'category', food.category,
            'section', food.section,
            'status', food.status,
            'kitchen', food.kitchen,
            'start', food.start_at,
            'requestedAt', COALESCE(food.requested_at, 0),
            'preparingAt', COALESCE(food.preparing_at, 0),
            'readyAt', COALESCE(food.ready_at, 0),
            'stoppedAt', COALESCE(food.stopped_at, 0),
            'closedAt', COALESCE(food.closed_at, 0)
          ) ORDER BY food.sort_order, food.id
        )
        FROM buffet_foods food
        WHERE food.active = true
      ), '[]'::jsonb) AS foods,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'at', recent.created_at,
            'action', recent.action,
            'food', recent.food_name,
            'section', recent.section_label,
            'detail', recent.detail
          ) ORDER BY recent.id DESC
        )
        FROM (
          SELECT id, created_at, action, food_name, section_label, detail
          FROM buffet_events
          ORDER BY id DESC
          LIMIT 200
        ) recent
      ), '[]'::jsonb) AS logs
    FROM buffet_service service
    WHERE service.id = 1
  `;

  if (!row) return { state: { foods: [], logs: [] }, updatedAt: 0 };
  return {
    state: {
      foods: asArray(row.foods),
      logs: asArray(row.logs),
    },
    updatedAt: Number(row.version || 0),
  };
}

async function conflictResponse(sql: Sql) {
  const latest = await readState(sql);
  return Response.json({ error: "STATE_CONFLICT", ...latest }, { status: 409 });
}

async function failedGateResponse(sql: Sql, expected: number, foodId?: number) {
  const [service] = await sql`SELECT version FROM buffet_service WHERE id=1`;
  const version = Number(service?.version || 0);
  if (expected && version !== expected) return conflictResponse(sql);
  if (foodId) return Response.json({ error: "Food not found" }, { status: 404 });
  return conflictResponse(sql);
}

async function runGated(
  sql: Sql,
  expected: number,
  now: number,
  token: string,
  queries: any[],
  options: { foodId?: number; serviceOpen?: boolean } = {},
) {
  const foodId = options.foodId || 0;
  const hasFoodGuard = foodId > 0;
  const serviceOpen = options.serviceOpen;

  const gate = serviceOpen === undefined
    ? hasFoodGuard
      ? sql`
          UPDATE buffet_service
          SET version=GREATEST(version + 1, ${now}), mutation_token=${token}, updated_at=${now}
          WHERE id=1
            AND (${expected}=0 OR version=${expected})
            AND EXISTS (SELECT 1 FROM buffet_foods WHERE id=${foodId} AND active=true)
          RETURNING version
        `
      : sql`
          UPDATE buffet_service
          SET version=GREATEST(version + 1, ${now}), mutation_token=${token}, updated_at=${now}
          WHERE id=1 AND (${expected}=0 OR version=${expected})
          RETURNING version
        `
    : hasFoodGuard
      ? sql`
          UPDATE buffet_service
          SET version=GREATEST(version + 1, ${now}), mutation_token=${token}, updated_at=${now}, is_open=${serviceOpen}
          WHERE id=1
            AND (${expected}=0 OR version=${expected})
            AND EXISTS (SELECT 1 FROM buffet_foods WHERE id=${foodId} AND active=true)
          RETURNING version
        `
      : sql`
          UPDATE buffet_service
          SET version=GREATEST(version + 1, ${now}), mutation_token=${token}, updated_at=${now}, is_open=${serviceOpen}
          WHERE id=1 AND (${expected}=0 OR version=${expected})
          RETURNING version
        `;

  const result = await sql.transaction([gate, ...queries] as any) as any[];
  const gateRows = result[0] as any[];
  return Array.isArray(gateRows) && gateRows.length > 0;
}

function tokenFor(now: number) {
  return `${now}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function GET(request: Request) {
  try {
    const sql = await ensureOpsSchema();
    const since = Number(new URL(request.url).searchParams.get("since") || 0);

    if (since > 0) {
      const [service] = await sql`SELECT version FROM buffet_service WHERE id=1`;
      const current = Number(service?.version || 0);
      if (current === since) return Response.json({ unchanged: true, updatedAt: current });
    }

    return Response.json(await readState(sql));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sql = await ensureOpsSchema();
    const expected = Number(body.expectedUpdatedAt || 0);
    const action = String(body.action || "");
    const now = Date.now();
    const token = tokenFor(now);

    if (action === "status") {
      const id = Number(body.id);
      const next = String(body.status || "").toUpperCase();
      if (!id) return Response.json({ error: "Food id required" }, { status: 400 });
      if (!["GOOD", "LOW", "EMPTY"].includes(next)) return Response.json({ error: "Invalid status" }, { status: 400 });
      const detail = next === "EMPTY"
        ? "Urgent kitchen request"
        : next === "LOW"
          ? "Prepare next tray"
          : "Floor confirmed display is good";

      const changed = sql`
        UPDATE buffet_foods food
        SET
          status=${next},
          kitchen=CASE
            WHEN ${next} IN ('LOW','EMPTY') AND COALESCE(food.kitchen,'idle')='idle' THEN 'requested'
            WHEN ${next}='GOOD' AND food.status<>'GOOD' AND food.kitchen='requested' THEN 'idle'
            ELSE food.kitchen
          END,
          requested_at=CASE
            WHEN ${next} IN ('LOW','EMPTY') AND COALESCE(food.kitchen,'idle')='idle' THEN ${now}
            WHEN ${next}='GOOD' AND food.status<>'GOOD' AND food.kitchen='requested' THEN NULL
            ELSE food.requested_at
          END,
          ready_at=CASE
            WHEN ${next} IN ('LOW','EMPTY') AND COALESCE(food.kitchen,'idle')='idle' THEN NULL
            WHEN ${next}='GOOD' AND food.status<>'GOOD' AND food.kitchen='requested' THEN NULL
            ELSE food.ready_at
          END,
          updated_at=${now}
        WHERE food.id=${id}
          AND food.active=true
          AND EXISTS (SELECT 1 FROM buffet_service service WHERE service.id=1 AND service.mutation_token=${token})
        RETURNING food.id
      `;
      const event = sql`
        INSERT INTO buffet_events (created_at, action, food_id, food_name, section_label, detail)
        SELECT ${now}, ${`${next} STATUS`}, food.id, food.name, ${`Section `} || food.section::text, ${detail}
        FROM buffet_foods food, buffet_service service
        WHERE food.id=${id}
          AND food.updated_at=${now}
          AND service.id=1
          AND service.mutation_token=${token}
      `;
      const ok = await runGated(sql, expected, now, token, [changed, event], { foodId: id });
      if (!ok) return failedGateResponse(sql, expected, id);
    } else if (action === "kitchen_prepare") {
      const id = Number(body.id);
      if (!id) return Response.json({ error: "Food id required" }, { status: 400 });
      const changed = sql`
        UPDATE buffet_foods food
        SET kitchen='preparing', preparing_at=${now}, updated_at=${now}
        WHERE food.id=${id}
          AND food.active=true
          AND food.kitchen='requested'
          AND EXISTS (SELECT 1 FROM buffet_service service WHERE service.id=1 AND service.mutation_token=${token})
        RETURNING food.id
      `;
      const event = sql`
        INSERT INTO buffet_events (created_at, action, food_id, food_name, section_label, detail)
        SELECT ${now}, 'PREPARING STARTED', food.id, food.name, ${`Section `} || food.section::text, 'Kitchen accepted request'
        FROM buffet_foods food, buffet_service service
        WHERE food.id=${id}
          AND food.preparing_at=${now}
          AND service.id=1
          AND service.mutation_token=${token}
      `;
      const ok = await runGated(sql, expected, now, token, [changed, event], { foodId: id });
      if (!ok) return failedGateResponse(sql, expected, id);
    } else if (action === "kitchen_ready") {
      const id = Number(body.id);
      if (!id) return Response.json({ error: "Food id required" }, { status: 400 });
      const changed = sql`
        UPDATE buffet_foods food
        SET kitchen='ready', ready_at=${now}, updated_at=${now}
        WHERE food.id=${id}
          AND food.active=true
          AND food.kitchen='preparing'
          AND EXISTS (SELECT 1 FROM buffet_service service WHERE service.id=1 AND service.mutation_token=${token})
        RETURNING food.id
      `;
      const event = sql`
        INSERT INTO buffet_events (created_at, action, food_id, food_name, section_label, detail)
        SELECT ${now}, 'READY TO REFILL', food.id, food.name, ${`Section `} || food.section::text, 'Kitchen finished; waiting for FOH confirmation'
        FROM buffet_foods food, buffet_service service
        WHERE food.id=${id}
          AND food.ready_at=${now}
          AND service.id=1
          AND service.mutation_token=${token}
      `;
      const ok = await runGated(sql, expected, now, token, [changed, event], { foodId: id });
      if (!ok) return failedGateResponse(sql, expected, id);
    } else if (action === "refilled") {
      const id = Number(body.id);
      if (!id) return Response.json({ error: "Food id required" }, { status: 400 });
      const changed = sql`
        UPDATE buffet_foods food
        SET
          kitchen='idle', status='GOOD', start_at=${now}, requested_at=NULL,
          preparing_at=NULL, ready_at=NULL, stopped_at=NULL, closed_at=NULL, updated_at=${now}
        WHERE food.id=${id}
          AND food.active=true
          AND EXISTS (SELECT 1 FROM buffet_service service WHERE service.id=1 AND service.mutation_token=${token})
        RETURNING food.id
      `;
      const event = sql`
        INSERT INTO buffet_events (created_at, action, food_id, food_name, section_label, detail)
        SELECT ${now}, 'NEW BATCH STARTED BY FOH', food.id, food.name, ${`Section `} || food.section::text, 'Refilled on floor; new service timer started'
        FROM buffet_foods food, buffet_service service
        WHERE food.id=${id}
          AND food.start_at=${now}
          AND service.id=1
          AND service.mutation_token=${token}
      `;
      const ok = await runGated(sql, expected, now, token, [changed, event], { foodId: id });
      if (!ok) return failedGateResponse(sql, expected, id);
    } else if (action === "start_all") {
      const changed = sql`
        UPDATE buffet_foods food
        SET
          start_at=${now}, status='GOOD', kitchen='idle', requested_at=NULL,
          preparing_at=NULL, ready_at=NULL, stopped_at=NULL, closed_at=NULL, updated_at=${now}
        WHERE food.active=true
          AND EXISTS (SELECT 1 FROM buffet_service service WHERE service.id=1 AND service.mutation_token=${token})
      `;
      const event = sql`
        INSERT INTO buffet_events (created_at, action, food_name, section_label, detail)
        SELECT
          ${now},
          'BULK START · ' || (SELECT COUNT(*)::text FROM buffet_foods WHERE active=true) || ' NEW BATCHES',
          'Store', 'All Sections', 'All items started together'
        FROM buffet_service service
        WHERE service.id=1 AND service.mutation_token=${token}
      `;
      const ok = await runGated(sql, expected, now, token, [changed, event], { serviceOpen: true });
      if (!ok) return failedGateResponse(sql, expected);
    } else if (action === "close_all") {
      const changed = sql`
        UPDATE buffet_foods food
        SET
          closed_at=${now}, stopped_at=${now}, status='CLOSED', kitchen='idle',
          requested_at=NULL, preparing_at=NULL, ready_at=NULL, updated_at=${now}
        WHERE food.active=true
          AND EXISTS (SELECT 1 FROM buffet_service service WHERE service.id=1 AND service.mutation_token=${token})
      `;
      const event = sql`
        INSERT INTO buffet_events (created_at, action, food_name, section_label, detail)
        SELECT
          ${now},
          'END OF DAY · ' || (SELECT COUNT(*)::text FROM buffet_foods WHERE active=true) || ' DISHES CLEARED',
          'Store', 'All Sections', 'All dishes cleared and kitchen tasks cancelled'
        FROM buffet_service service
        WHERE service.id=1 AND service.mutation_token=${token}
      `;
      const ok = await runGated(sql, expected, now, token, [changed, event], { serviceOpen: false });
      if (!ok) return failedGateResponse(sql, expected);
    } else if (action === "dish_add") {
      const name = String(body.name || "").trim();
      const category = String(body.category || "Other").trim() || "Other";
      const section = Number(body.section) === 2 ? 2 : 1;
      if (!name) return Response.json({ error: "Dish name is required" }, { status: 400 });

      const changed = sql`
        INSERT INTO buffet_foods (
          name, category, section, status, kitchen, start_at, sort_order, active, updated_at
        )
        SELECT
          ${name}, ${category}, ${section}, 'GOOD', 'idle', 0,
          COALESCE((SELECT MAX(sort_order) + 1 FROM buffet_foods), 0), true, ${now}
        WHERE EXISTS (SELECT 1 FROM buffet_service service WHERE service.id=1 AND service.mutation_token=${token})
        RETURNING id
      `;
      const event = sql`
        INSERT INTO buffet_events (created_at, action, food_name, section_label, detail)
        SELECT ${now}, 'DISH ADDED', ${name}, ${`Section ${section}`}, ${`${category} · Section ${section}`}
        FROM buffet_service service
        WHERE service.id=1 AND service.mutation_token=${token}
      `;
      const ok = await runGated(sql, expected, now, token, [changed, event]);
      if (!ok) return failedGateResponse(sql, expected);
    } else if (action === "dish_update") {
      const id = Number(body.id);
      const name = String(body.name || "").trim();
      const category = String(body.category || "Other").trim() || "Other";
      const section = Number(body.section) === 2 ? 2 : 1;
      if (!id) return Response.json({ error: "Food id required" }, { status: 400 });
      if (!name) return Response.json({ error: "Dish name is required" }, { status: 400 });

      const changed = sql`
        UPDATE buffet_foods food
        SET name=${name}, category=${category}, section=${section}, updated_at=${now}
        WHERE food.id=${id}
          AND food.active=true
          AND EXISTS (SELECT 1 FROM buffet_service service WHERE service.id=1 AND service.mutation_token=${token})
        RETURNING food.id
      `;
      const event = sql`
        INSERT INTO buffet_events (created_at, action, food_id, food_name, section_label, detail)
        SELECT ${now}, 'DISH UPDATED', food.id, food.name, ${`Section `} || food.section::text, ${`${category} · Section ${section}`}
        FROM buffet_foods food, buffet_service service
        WHERE food.id=${id}
          AND food.updated_at=${now}
          AND service.id=1
          AND service.mutation_token=${token}
      `;
      const ok = await runGated(sql, expected, now, token, [changed, event], { foodId: id });
      if (!ok) return failedGateResponse(sql, expected, id);
    } else if (action === "dish_delete") {
      const id = Number(body.id);
      if (!id) return Response.json({ error: "Food id required" }, { status: 400 });
      const changed = sql`
        UPDATE buffet_foods food
        SET active=false, updated_at=${now}
        WHERE food.id=${id}
          AND food.active=true
          AND EXISTS (SELECT 1 FROM buffet_service service WHERE service.id=1 AND service.mutation_token=${token})
        RETURNING food.id
      `;
      const event = sql`
        INSERT INTO buffet_events (created_at, action, food_id, food_name, section_label, detail)
        SELECT ${now}, 'DISH REMOVED', food.id, food.name, ${`Section `} || food.section::text, 'Removed from active buffet list'
        FROM buffet_foods food, buffet_service service
        WHERE food.id=${id}
          AND food.active=false
          AND food.updated_at=${now}
          AND service.id=1
          AND service.mutation_token=${token}
      `;
      const ok = await runGated(sql, expected, now, token, [changed, event], { foodId: id });
      if (!ok) return failedGateResponse(sql, expected, id);
    } else {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    return Response.json(await readState(sql));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
