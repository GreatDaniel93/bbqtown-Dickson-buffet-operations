import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";

function asObject(value: unknown): any {
  if (!value) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function log(state: any, action: string, food: any, detail: string) {
  const logs = Array.isArray(state.logs) ? state.logs : [];
  logs.unshift({
    at: Date.now(),
    action,
    food: food?.name || "Store",
    section: food ? `Section ${food.section}` : "All Sections",
    detail,
  });
  // The live app does not need to rewrite 1000 historical log entries on every tap.
  // Keep a bounded recent window; historical/ops logs belong in dedicated tables.
  state.logs = logs.slice(0, 200);
}

function publicState(state: any, updatedAt: number) {
  return Response.json({
    state: {
      foods: Array.isArray(state?.foods) ? state.foods : [],
      logs: Array.isArray(state?.logs) ? state.logs : [],
    },
    updatedAt,
  });
}

async function conflictResponse(sql: Awaited<ReturnType<typeof ensureOpsSchema>>) {
  const [latest] = await sql`SELECT payload, updated_at FROM buffet_state WHERE id=1`;
  if (!latest) return Response.json({ error: "Buffet state is not initialized" }, { status: 409 });
  return Response.json(
    { error: "STATE_CONFLICT", state: asObject(latest.payload), updatedAt: Number(latest.updated_at) },
    { status: 409 },
  );
}

export async function GET(request: Request) {
  try {
    const sql = await ensureOpsSchema();
    const [row] = await sql`SELECT payload, updated_at FROM buffet_state WHERE id=1`;
    if (!row) return Response.json({ state: { foods: [], logs: [] }, updatedAt: 0 });

    const updatedAt = Number(row.updated_at);
    const since = Number(new URL(request.url).searchParams.get("since") || 0);
    if (since > 0 && since === updatedAt) {
      return Response.json({ unchanged: true, updatedAt });
    }
    return publicState(asObject(row.payload), updatedAt);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sql = await ensureOpsSchema();
    const [row] = await sql`SELECT payload, updated_at FROM buffet_state WHERE id=1`;
    if (!row) return Response.json({ error: "Buffet state is not initialized" }, { status: 409 });

    const currentUpdatedAt = Number(row.updated_at);
    const expected = Number(body.expectedUpdatedAt || 0);
    const state = asObject(row.payload) || { foods: [], logs: [] };
    if (expected && expected !== currentUpdatedAt) {
      return Response.json({ error: "STATE_CONFLICT", state, updatedAt: currentUpdatedAt }, { status: 409 });
    }

    const foods = Array.isArray(state.foods) ? state.foods : [];
    const action = String(body.action || "");
    const now = Date.now();

    if (action === "status") {
      const id = Number(body.id);
      const next = String(body.status || "").toUpperCase();
      if (!["GOOD", "LOW", "EMPTY"].includes(next)) return Response.json({ error: "Invalid status" }, { status: 400 });
      const food = foods.find((f: any) => Number(f.id) === id);
      if (!food) return Response.json({ error: "Food not found" }, { status: 404 });
      const old = food.status;
      const wasIdle = food.kitchen === "idle" || !food.kitchen;
      food.status = next;
      if (next === "LOW" || next === "EMPTY") {
        if (wasIdle) {
          food.kitchen = "requested";
          food.requestedAt = now;
          delete food.readyAt;
        }
      } else if (old !== "GOOD" && food.kitchen === "requested") {
        food.kitchen = "idle";
        delete food.requestedAt;
        delete food.readyAt;
      }
      log(state, `${next} STATUS`, food, next === "EMPTY" ? "Urgent kitchen request" : next === "LOW" ? "Prepare next tray" : "Floor confirmed display is good");
    } else if (action === "kitchen_prepare") {
      const food = foods.find((f: any) => Number(f.id) === Number(body.id));
      if (!food) return Response.json({ error: "Food not found" }, { status: 404 });
      if (food.kitchen === "requested") {
        food.kitchen = "preparing";
        food.preparingAt = now;
        log(state, "PREPARING STARTED", food, "Kitchen accepted request");
      }
    } else if (action === "kitchen_ready") {
      const food = foods.find((f: any) => Number(f.id) === Number(body.id));
      if (!food) return Response.json({ error: "Food not found" }, { status: 404 });
      if (food.kitchen === "preparing") {
        food.kitchen = "ready";
        food.readyAt = now;
        log(state, "READY TO REFILL", food, "Kitchen finished; waiting for FOH confirmation");
      }
    } else if (action === "refilled") {
      const food = foods.find((f: any) => Number(f.id) === Number(body.id));
      if (!food) return Response.json({ error: "Food not found" }, { status: 404 });
      food.kitchen = "idle";
      food.status = "GOOD";
      food.start = now;
      delete food.requestedAt;
      delete food.preparingAt;
      delete food.readyAt;
      delete food.stoppedAt;
      delete food.closedAt;
      log(state, "NEW BATCH STARTED BY FOH", food, "Refilled on floor; new service timer started");
    } else if (action === "start_all") {
      foods.forEach((food: any) => {
        food.start = now;
        food.status = "GOOD";
        food.kitchen = "idle";
        delete food.requestedAt;
        delete food.preparingAt;
        delete food.readyAt;
        delete food.stoppedAt;
        delete food.closedAt;
      });
      log(state, `BULK START · ${foods.length} NEW BATCHES`, null, "All items started together");
    } else if (action === "close_all") {
      foods.forEach((food: any) => {
        food.closedAt = now;
        food.stoppedAt = now;
        food.status = "CLOSED";
        food.kitchen = "idle";
      });
      log(state, `END OF DAY · ${foods.length} DISHES CLEARED`, null, "All dishes cleared and kitchen tasks cancelled");
    } else if (action === "dish_add") {
      const name = String(body.name || "").trim();
      const category = String(body.category || "Other").trim() || "Other";
      const section = Number(body.section) === 2 ? 2 : 1;
      if (!name) return Response.json({ error: "Dish name is required" }, { status: 400 });
      const id = foods.reduce((max: number, f: any) => Math.max(max, Number(f.id) || 0), 0) + 1;
      const food = { id, name, category, section, status: "GOOD", kitchen: "idle", start: 0 };
      foods.push(food);
      log(state, "DISH ADDED", food, `${category} · Section ${section}`);
    } else if (action === "dish_update") {
      const id = Number(body.id);
      const food = foods.find((f: any) => Number(f.id) === id);
      if (!food) return Response.json({ error: "Food not found" }, { status: 404 });
      const name = String(body.name || "").trim();
      if (!name) return Response.json({ error: "Dish name is required" }, { status: 400 });
      food.name = name;
      food.category = String(body.category || "Other").trim() || "Other";
      food.section = Number(body.section) === 2 ? 2 : 1;
      log(state, "DISH UPDATED", food, `${food.category} · Section ${food.section}`);
    } else if (action === "dish_delete") {
      const id = Number(body.id);
      const index = foods.findIndex((f: any) => Number(f.id) === id);
      if (index < 0) return Response.json({ error: "Food not found" }, { status: 404 });
      const [food] = foods.splice(index, 1);
      log(state, "DISH REMOVED", food, "Removed from active buffet list");
    } else {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    // Monotonic version + compare-and-swap prevents two tablets from silently
    // overwriting each other when they act at the same time.
    const updatedAt = Math.max(Date.now(), currentUpdatedAt + 1);
    const payload = JSON.stringify({ foods, logs: Array.isArray(state.logs) ? state.logs : [] });
    const [saved] = await sql`
      UPDATE buffet_state
      SET payload=${payload}::jsonb, updated_at=${updatedAt}
      WHERE id=1 AND updated_at=${currentUpdatedAt}
      RETURNING updated_at
    `;

    if (!saved) return conflictResponse(sql);
    return publicState({ foods, logs: state.logs }, updatedAt);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
