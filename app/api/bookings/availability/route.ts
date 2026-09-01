import { ensureReservationSchema, readSettings, slotsForDate, validDate } from "../../_lib/reservations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date") || "";
    if (!validDate(date)) return Response.json({ error: "Invalid date" }, { status: 400 });
    const settings = await readSettings();
    const baseSlots = slotsForDate(settings, date);
    if (!baseSlots.length) return Response.json({ enabled: settings.enabled, slots: [], maxPartySize: settings.maxPartySize });
    const sql = await ensureReservationSchema();
    const rows = await sql`
      SELECT EXTRACT(HOUR FROM booking_time)::int AS hour, COALESCE(sum(party_size), 0)::int AS covers
      FROM reservations
      WHERE booking_date = ${date}::date AND status NOT IN ('cancelled', 'no_show')
      GROUP BY EXTRACT(HOUR FROM booking_time)
    `;
    const used = new Map(rows.map((row) => [Number(row.hour), Number(row.covers)]));
    const slots = baseSlots.map((time) => ({
      time,
      remaining: Math.max(0, settings.maxCoversPerHour - (used.get(Number(time.slice(0, 2))) || 0)),
    }));
    return Response.json({ enabled: settings.enabled, slots, maxPartySize: settings.maxPartySize });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
