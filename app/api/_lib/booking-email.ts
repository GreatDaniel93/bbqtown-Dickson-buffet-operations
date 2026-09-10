import { Resend } from "resend";

export type BookingEmailKind = "confirmed" | "updated" | "cancelled";

export type BookingEmailData = {
  reference: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  email: string;
};

export type StaffBookingEmailData = {
  reference: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  phone: string;
  email?: string;
  notes?: string;
  source: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

function prettyDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00+10:00`));
}

function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const emailDomain = process.env.RESEND_EMAIL_DOMAIN || "bbqtowndickson.com";
  const from = process.env.BOOKING_EMAIL_FROM
    || `BBQTOWN Dickson Reservations <bookings@${emailDomain}>`;
  return { apiKey, from };
}

export async function sendBookingEmail(data: BookingEmailData, kind: BookingEmailKind, managementToken: string, version: string) {
  const { apiKey, from } = emailConfig();
  if (!apiKey) return { sent: false, reason: "not_configured" as const };

  const siteUrl = (process.env.PUBLIC_SITE_URL || "https://bbqtowndickson.com").replace(/\/$/, "");
  const manageUrl = `${siteUrl}/manage-booking.html#token=${encodeURIComponent(managementToken)}`;
  const heading = kind === "confirmed" ? "Reservation confirmed" : kind === "updated" ? "Reservation updated" : "Reservation cancelled";
  const subject = `${heading} · ${data.reference}`;
  const statusCopy = kind === "cancelled"
    ? "Your reservation has been cancelled."
    : `Your table is booked for ${escapeHtml(prettyDate(data.date))} at ${escapeHtml(data.time)} for ${data.partySize} ${data.partySize === 1 ? "guest" : "guests"}.`;
  const action = kind === "cancelled" ? "View cancelled reservation" : "View, change party size, or cancel";
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,sans-serif;color:#20130e"><div style="max-width:600px;margin:0 auto;padding:32px 18px"><div style="background:#172018;color:#fff;padding:30px;border-radius:18px 18px 0 0"><div style="font-weight:900;letter-spacing:2px;color:#efbd65">BBQTOWN DICKSON</div><h1 style="margin:14px 0 0;font-size:32px">${heading}</h1></div><div style="background:#fff;padding:30px;border-radius:0 0 18px 18px"><p>Hi ${escapeHtml(data.guestName)},</p><p style="font-size:17px;line-height:1.6">${statusCopy}</p><div style="background:#f7f2ea;border-radius:12px;padding:18px;margin:22px 0"><div style="font-size:12px;color:#806e61;font-weight:700">BOOKING REFERENCE</div><div style="font-size:25px;font-weight:900;letter-spacing:2px;margin-top:5px">${escapeHtml(data.reference)}</div>${kind === "cancelled" ? "" : `<div style="margin-top:15px;line-height:1.7">${escapeHtml(prettyDate(data.date))}<br>${escapeHtml(data.time)} · ${data.partySize} ${data.partySize === 1 ? "guest" : "guests"}</div>`}</div><a href="${escapeHtml(manageUrl)}" style="display:block;background:#b23728;color:#fff;text-align:center;text-decoration:none;font-weight:900;padding:15px;border-radius:10px">${action}</a><p style="font-size:12px;color:#806e61;line-height:1.5;margin-top:22px">This link is private and gives access only to this reservation. Do not forward it.</p><p style="font-size:13px;color:#806e61;line-height:1.5">BBQTOWN Dickson<br>6/28 Challis St, Dickson ACT 2602</p></div></div></body></html>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: data.email,
    subject,
    html,
  }, {
    idempotencyKey: `booking-${kind}-${data.reference}-${version.replace(/[^A-Za-z0-9]/g, "")}`,
  });
  if (error) throw new Error(error.message);
  return { sent: true as const };
}

export async function sendStaffBookingNotification(data: StaffBookingEmailData, version: string) {
  const { apiKey, from } = emailConfig();
  if (!apiKey) return { sent: false, reason: "not_configured" as const };

  const to = process.env.BOOKING_NOTIFICATION_EMAIL || "bbqtowndickson@gmail.com";
  const siteUrl = (process.env.PUBLIC_SITE_URL || "https://bbqtowndickson.com").replace(/\/$/, "");
  const reservationsUrl = `${siteUrl}/reservations.html?date=${encodeURIComponent(data.date)}`;
  const sourceLabel = data.source === "staff" ? "STAFF / PHONE BOOKING" : "ONLINE BOOKING";
  const contactEmail = data.email ? escapeHtml(data.email) : "Not provided";
  const notes = data.notes ? escapeHtml(data.notes) : "None";
  const subject = `NEW BOOKING · ${data.date} ${data.time} · ${data.partySize} · ${data.guestName}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:Arial,sans-serif;color:#20130e"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="background:#172018;color:#fff;padding:28px;border-radius:18px 18px 0 0"><div style="font-weight:900;letter-spacing:2px;color:#efbd65">BBQTOWN DICKSON</div><h1 style="margin:12px 0 4px;font-size:30px">New booking received</h1><div style="color:#cbd5cd;font-weight:800">${sourceLabel}</div></div><div style="background:#fff;padding:28px;border-radius:0 0 18px 18px"><div style="font-size:22px;font-weight:900">${escapeHtml(data.guestName)} · ${data.partySize} ${data.partySize === 1 ? "guest" : "guests"}</div><div style="font-size:18px;margin-top:8px">${escapeHtml(prettyDate(data.date))}<br><strong>${escapeHtml(data.time)}</strong></div><div style="background:#f7f2ea;border-radius:12px;padding:18px;margin:22px 0;line-height:1.8"><strong>Reference:</strong> ${escapeHtml(data.reference)}<br><strong>Phone:</strong> ${escapeHtml(data.phone)}<br><strong>Email:</strong> ${contactEmail}<br><strong>Notes:</strong> ${notes}</div><a href="${escapeHtml(reservationsUrl)}" style="display:block;background:#b23728;color:#fff;text-align:center;text-decoration:none;font-weight:900;padding:15px;border-radius:10px">OPEN RESERVATIONS</a></div></div></body></html>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  }, {
    idempotencyKey: `staff-booking-${data.reference}-${version.replace(/[^A-Za-z0-9]/g, "")}`,
  });
  if (error) throw new Error(error.message);
  return { sent: true as const };
}
