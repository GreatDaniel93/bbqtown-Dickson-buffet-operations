import { authorized } from "../../_lib/admin-auth";
import { sendBookingEmail, sendStaffBookingNotification } from "../../_lib/booking-email";
import { ensureReservationSchema, hashManagementToken, makeManagementToken, makeReference, validDate, validEmail, validTime } from "../../_lib/reservations";

export const dynamic = "force-dynamic";
const statuses = new Set(["confirmed", "arrived", "seated", "completed", "cancelled", "no_show"]);

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const date = new URL(request.url).searchParams.get("date") || "";
  if (!validDate(date)) return Response.json({ error: "Invalid date" }, { status: 400 });
  const sql = await ensureReservationSchema();
  const rows = await sql`
    SELECT id, reference, to_char(booking_date, 'YYYY-MM-DD') AS date, to_char(booking_time, 'HH24:MI') AS time,
           party_size, guest_name, phone, email, notes, status, source, created_at, updated_at
    FROM reservations WHERE booking_date = ${date}::date ORDER BY booking_time, created_at
  `;
  return Response.json({ reservations: rows });
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const date = String(body.date || "");
    const time = String(body.time || "");
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const notes = String(body.notes || "").trim();
    const partySize = Number(body.partySize);

    if (!validDate(date) || !validTime(time) || !name || name.length > 100 || phone.length < 6 || phone.length > 30 || (email && !validEmail(email)) || notes.length > 600 || !Number.isInteger(partySize) || partySize < 1 || partySize > 120) {
      return Response.json({ error: "Please check the booking details." }, { status: 400 });
    }

    const sql = await ensureReservationSchema();
    const managementToken = makeManagementToken();
    const managementTokenHash = hashManagementToken(managementToken);
    let reference = makeReference();
    let created: Record<string, unknown> | undefined;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        [created] = await sql`
          INSERT INTO reservations (reference, booking_date, booking_time, party_size, guest_name, phone, email, notes, source, management_token_hash)
          VALUES (${reference}, ${date}::date, ${time}::time, ${partySize}, ${name}, ${phone}, ${email || null}, ${notes || null}, 'staff', ${managementTokenHash})
          RETURNING id, reference, to_char(booking_date, 'YYYY-MM-DD') AS date, to_char(booking_time, 'HH24:MI') AS time,
                    party_size, guest_name, phone, email, notes, status, source, created_at, updated_at
        `;
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        reference = makeReference();
      }
    }

    if (!created) throw new Error("Could not create booking");
    const version = new Date(String(created.created_at)).toISOString();
    let emailSent = false;
    let staffNotified = false;

    if (email) {
      try {
        const mail = await sendBookingEmail({ reference, date, time, partySize, guestName: name, email }, "confirmed", managementToken, version);
        emailSent = mail.sent;
      } catch (emailError) {
        console.error("Staff booking guest confirmation failed", emailError instanceof Error ? emailError.message : "Unknown email error");
      }
    }

    try {
      const staffMail = await sendStaffBookingNotification({ reference, date, time, partySize, guestName: name, phone, email: email || undefined, notes, source: "staff" }, version);
      staffNotified = staffMail.sent;
    } catch (emailError) {
      console.error("Staff booking restaurant notification failed", emailError instanceof Error ? emailError.message : "Unknown email error");
    }

    return Response.json({ ok: true, reservation: created, emailSent, staffNotified });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create booking" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { id?: number; status?: string };
  if (!Number.isInteger(body.id) || !statuses.has(String(body.status))) return Response.json({ error: "Invalid update" }, { status: 400 });
  const sql = await ensureReservationSchema();
  const [row] = await sql`
    UPDATE reservations SET status = ${String(body.status)}, updated_at = now()
    WHERE id = ${Number(body.id)} RETURNING id, status, updated_at
  `;
  if (!row) return Response.json({ error: "Reservation not found" }, { status: 404 });
  return Response.json({ ok: true, reservation: row });
}
