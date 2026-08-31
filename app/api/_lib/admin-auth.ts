import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "bbqtown_admin";

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "";
}

function token() {
  return createHmac("sha256", secret()).update("bbqtown-dickson-admin-v1").digest("hex");
}

export function configured() {
  return Boolean(process.env.ADMIN_PIN && secret());
}

export function verifyPin(pin: string) {
  const expected = process.env.ADMIN_PIN || "";
  if (!configured() || pin.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(pin), Buffer.from(expected));
}

export function authorized(request: Request) {
  if (!configured()) return false;
  const match = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  const supplied = match?.[1] || "";
  const expected = token();
  return supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function loginCookie() {
  return `${COOKIE}=${token()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
}

export function logoutCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
