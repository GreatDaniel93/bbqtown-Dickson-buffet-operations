import { ensureReservationSchema, makeReference, readSettings, slotsForDate, validDate, validTime } from "../_lib/reservations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const date = String(body.date || "");
    const time = String(body.time || "");
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const notes = String(body.notes || "").trim();
    const partySize = Number(body.partySize);
    if (!validDate(date) || !validTime(time) || !name || name.length > 100 || phone.length < 6 || phone.length > 30 || email.length > 160 || notes.length > 600) {
      return Response.json({ error: "Please check the booking details." }, { status: 400 });
    }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const settings = await readSettings();
    const maxDate = new Date(`${today}T12:00:00+10:00`);
    maxDate.setDate(maxDate.getDate() + settings.bookingWindowDays);
    const max = maxDate.toISOString().slice(0, 10);
    if (!settings.enabled || date < today || date > max || !Number.isInteger(partySize) || partySize < 1 || partySize > settings.maxPartySize || !slotsForDate(settings, date).includes(time)) {
      return Response.json({ error: "This date, time or party size is unavailable." }, { status: 409 });
    }
    const sql = await ensureReservationSchema();
    const [capacity] = await sql`
      SELECT COALESCE(sum(party_size), 0)::int AS covers
      FROM reservations
      WHERE booking_date = ${date}::date AND booking_time = ${time}::time AND status NOT IN ('cancelled', 'no_show')
    `;
    if (Number(capacity.covers) + partySize > settings.maxCoversPerSlot) {
      return Response.json({ error: "That time has just filled up. Please choose another time." }, { status: 409 });
    }
    let reference = makeReference();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await sql`
          INSERT INTO reservations (reference, booking_date, booking_time, party_size, guest_name, phone, email, notes)
          VALUES (${reference}, ${date}::date, ${time}::time, ${partySize}, ${name}, ${phone}, ${email || null}, ${notes || null})
        `;
        return Response.json({ ok: true, reference, date, time, partySize });
      } catch (error) {
        if (attempt === 2) throw error;
        reference = makeReference();
      }
    }
    throw new Error("Could not create booking");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Booking unavailable" }, { status: 500 });
  }
}
