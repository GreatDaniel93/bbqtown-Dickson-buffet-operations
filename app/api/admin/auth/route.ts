import { authorized, configured, loginCookie, logoutCookie, verifyPin } from "../../_lib/admin-auth";

export async function GET(request: Request) {
  return Response.json({ configured: configured(), authenticated: authorized(request) });
}

export async function POST(request: Request) {
  const { pin } = await request.json() as { pin?: string };
  if (!configured()) return Response.json({ error: "Manager PIN has not been configured." }, { status: 503 });
  if (!verifyPin(String(pin || ""))) return Response.json({ error: "Incorrect PIN." }, { status: 401 });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": loginCookie() } });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": logoutCookie() } });
}
