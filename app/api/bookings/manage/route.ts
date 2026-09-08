import { sendBookingEmail } from "../../_lib/booking-email";
import { ensureReservationSchema, hashManagementToken, readSettings, validManagementToken } from "../../_lib/reservations";

export const dynamic = "force-dynamic";

function tokenFrom(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7);
  const url = new URL(request.url);
  return url.searchParams.get("token") || "";
}

function bookingPayload(row: Record<string, unknown>) {
  return {
    reference: String(row.reference),
    date: String(row.date),
    time: String(row.time),
    partySize: Number(row.party_size),
    guestName: String(row.guest_name),
    email: String(row.email),
    notes: row.notes ? String(row.notes) : "",
    status: String(row.status),
    updatedAt: row.updated_at,
  };
}

async function findBooking(token: string) {
  if (!validManagementToken(token)) return null;
  const sql = await ensureReservationSchema();
  const [row] = await sql`
    SELECT id, reference, to_char(booking_date, 'YYYY-MM-DD') AS date,
      to_char(booking_time, 'HH24:MI') AS time, party_size, guest_name,
      email, notes, status, updated_at
    FROM reservations
    WHERE management_token_hash = ${hashManagementToken(token)}
    LIMIT 1
  `;
  return row || null;
}

export async function GET(request: Request) {
  try {
    const token = tokenFrom(request);
    const row = await findBooking(token);
    if (!row) return Response.json({ error: "This booking link is invalid." }, { status: 404 });
    const settings = await readSettings();
    return Response.json({ booking: bookingPayload(row), maxPartySize: settings.maxPartySize });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Booking unavailable" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const token = tokenFrom(request);
    if (!validManagementToken(token)) return Response.json({ error: "This booking link is invalid." }, { status: 404 });
    const body = await request.json() as { partySize?: number };
    const partySize = Number(body.partySize);
    const settings = await readSettings();
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > settings.maxPartySize) {
      return Response.json({ error: "Please choose a valid party size." }, { status: 400 });
    }

    const sql = await ensureReservationSchema();
    const tokenHash = hashManagementToken(token);
    const [current] = await sql`
      SELECT id, reference, to_char(booking_date, 'YYYY-MM-DD') AS date,
        to_char(booking_time, 'HH24:MI') AS time, booking_date, booking_time,
        party_size, guest_name, email, notes, status, updated_at
      FROM reservations
      WHERE management_token_hash = ${tokenHash}
      LIMIT 1
    `;
    if (!current) return Response.json({ error: "This booking link is invalid." }, { status: 404 });
    if (current.status !== "confirmed") return Response.json({ error: "Only confirmed reservations can be changed online." }, { status: 409 });

    const [capacity] = await sql`
      SELECT COALESCE(sum(party_size), 0)::int AS covers
      FROM reservations
      WHERE booking_date = ${current.date}::date
        AND EXTRACT(HOUR FROM booking_time) = ${Number(String(current.time).slice(0, 2))}
        AND id <> ${Number(current.id)}
        AND status NOT IN ('cancelled', 'no_show')
    `;
    if (Number(capacity.covers) + partySize > settings.maxCoversPerHour) {
      return Response.json({ error: "That time no longer has enough room for this party size." }, { status: 409 });
    }

    const [updated] = await sql`
      UPDATE reservations
      SET party_size = ${partySize}, updated_at = now()
      WHERE id = ${Number(current.id)} AND management_token_hash = ${tokenHash} AND status = 'confirmed'
      RETURNING id, reference, to_char(booking_date, 'YYYY-MM-DD') AS date,
        to_char(booking_time, 'HH24:MI') AS time, party_size, guest_name,
        email, notes, status, updated_at
    `;
    if (!updated) return Response.json({ error: "The reservation could not be changed." }, { status: 409 });

    let emailSent = false;
    try {
      const mail = await sendBookingEmail({ reference: String(updated.reference), date: String(updated.date), time: String(updated.time), partySize: Number(updated.party_size), guestName: String(updated.guest_name), email: String(updated.email) }, "updated", token, new Date(updated.updated_at).toISOString());
      emailSent = mail.sent;
    } catch (emailError) {
      console.error("Booking update email failed", emailError instanceof Error ? emailError.message : "Unknown email error");
    }
    return Response.json({ ok: true, booking: bookingPayload(updated), emailSent });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Booking unavailable" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const token = tokenFrom(request);
    if (!validManagementToken(token)) return Response.json({ error: "This booking link is invalid." }, { status: 404 });
    const sql = await ensureReservationSchema();
    const tokenHash = hashManagementToken(token);
    const [cancelled] = await sql`
      UPDATE reservations
      SET status = 'cancelled', cancelled_at = now(), updated_at = now()
      WHERE management_token_hash = ${tokenHash} AND status = 'confirmed'
      RETURNING id, reference, to_char(booking_date, 'YYYY-MM-DD') AS date,
        to_char(booking_time, 'HH24:MI') AS time, party_size, guest_name,
        email, notes, status, updated_at
    `;
    if (!cancelled) {
      const existing = await findBooking(token);
      if (!existing) return Response.json({ error: "This booking link is invalid." }, { status: 404 });
      if (existing.status === "cancelled") return Response.json({ ok: true, booking: bookingPayload(existing), emailSent: false });
      return Response.json({ error: "This reservation can no longer be cancelled online." }, { status: 409 });
    }

    let emailSent = false;
    try {
      const mail = await sendBookingEmail({ reference: String(cancelled.reference), date: String(cancelled.date), time: String(cancelled.time), partySize: Number(cancelled.party_size), guestName: String(cancelled.guest_name), email: String(cancelled.email) }, "cancelled", token, new Date(cancelled.updated_at).toISOString());
      emailSent = mail.sent;
    } catch (emailError) {
      console.error("Booking cancellation email failed", emailError instanceof Error ? emailError.message : "Unknown email error");
    }
    return Response.json({ ok: true, booking: bookingPayload(cancelled), emailSent });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Booking unavailable" }, { status: 500 });
  }
}
