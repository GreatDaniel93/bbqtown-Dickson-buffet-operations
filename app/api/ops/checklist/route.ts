import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  opening: [
    ["fridges", "Check fridge/freezer temperatures"],
    ["handwash", "Hand wash stations stocked"],
    ["prep", "Food prep and labels checked"],
    ["hotbar", "Hot display / buffet ready"],
    ["foh", "FOH tables and dining area ready"],
    ["devices", "Ops tablets online and sound tested"],
  ],
  closing: [
    ["food", "Food stored, labelled or discarded correctly"],
    ["clean", "Kitchen and buffet cleaning complete"],
    ["chemicals", "Chemicals stored correctly"],
    ["tables", "Dining area and tables reset"],
    ["waste", "Waste removed and bins secured"],
    ["handover", "Manager handover notes completed"],
  ],
} as const;

function todaySydney() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function seed(sql: Awaited<ReturnType<typeof ensureOpsSchema>>, date: string, shift: "opening" | "closing") {
  for (const [key, label] of DEFAULTS[shift]) {
    await sql`
      INSERT INTO ops_daily_checklist (service_date, shift, item_key, label)
      VALUES (${date}, ${shift}, ${key}, ${label})
      ON CONFLICT (service_date, shift, item_key) DO NOTHING
    `;
  }
}

export async function GET(request: Request) {
  try {
    const sql = await ensureOpsSchema();
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || todaySydney();
    await seed(sql, date, "opening");
    await seed(sql, date, "closing");
    const rows = await sql`
      SELECT service_date, shift, item_key, label, completed, completed_at, completed_by
      FROM ops_daily_checklist
      WHERE service_date = ${date}
      ORDER BY shift, item_key
    `;
    return Response.json({ date, items: rows.map((r) => ({ ...r, completed_at: r.completed_at ? Number(r.completed_at) : null })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { date?: string; shift?: string; itemKey?: string; completed?: boolean; completedBy?: string };
    const date = String(body.date || todaySydney()).slice(0, 10);
    const shift = body.shift === "closing" ? "closing" : "opening";
    const itemKey = String(body.itemKey || "").slice(0, 80);
    if (!itemKey) return Response.json({ error: "itemKey is required" }, { status: 400 });
    const sql = await ensureOpsSchema();
    await seed(sql, date, shift);
    const completed = body.completed === true;
    const completedAt = completed ? Date.now() : null;
    const completedBy = String(body.completedBy || "manager").slice(0, 80);
    await sql`
      UPDATE ops_daily_checklist
      SET completed = ${completed}, completed_at = ${completedAt}, completed_by = ${completedBy}
      WHERE service_date = ${date} AND shift = ${shift} AND item_key = ${itemKey}
    `;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
