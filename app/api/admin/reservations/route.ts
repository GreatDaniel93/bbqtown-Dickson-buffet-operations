import { authorized } from "../../_lib/admin-auth";
import { ensureReservationSchema, validDate } from "../../_lib/reservations";

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
