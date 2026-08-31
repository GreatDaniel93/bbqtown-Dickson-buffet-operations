import { authorized } from "../../_lib/admin-auth";
import { BookingSettings, ensureReservationSchema, readSettings, validTime } from "../../_lib/reservations";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ settings: await readSettings() });
}

export async function PUT(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const settings = await request.json() as BookingSettings;
    const validHours = Array.isArray(settings.hours) && settings.hours.length === 7 && settings.hours.every((day) => typeof day.enabled === "boolean" && validTime(day.open) && validTime(day.close));
    if (!validHours || ![15, 30, 60].includes(Number(settings.slotMinutes)) || !Number.isInteger(settings.maxCoversPerSlot) || settings.maxCoversPerSlot < 1 || !Number.isInteger(settings.maxPartySize) || settings.maxPartySize < 1 || settings.maxPartySize > settings.maxCoversPerSlot || !Number.isInteger(settings.bookingWindowDays) || settings.bookingWindowDays < 1 || settings.bookingWindowDays > 365) {
      return Response.json({ error: "Please check all booking settings." }, { status: 400 });
    }
    const sql = await ensureReservationSchema();
    const payload = JSON.stringify(settings);
    await sql`
      INSERT INTO booking_settings (id, payload, updated_at) VALUES (1, ${payload}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
    `;
    return Response.json({ ok: true, settings });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save settings" }, { status: 500 });
  }
}
