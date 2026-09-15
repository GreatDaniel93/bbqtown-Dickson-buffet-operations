import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ACCESS_TTL_MS = 3 * 60 * 1000;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "";
}

function b64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export type DeviceAccess = {
  deviceId: string;
  role: string;
  exp: number;
};

export function createDeviceAccessToken(deviceId: string, role: string, now = Date.now()) {
  if (!secret()) throw new Error("ADMIN_SESSION_SECRET is not configured");
  const payload: DeviceAccess = {
    deviceId: String(deviceId || "").slice(0, 120),
    role: String(role || "unknown").slice(0, 40),
    exp: now + ACCESS_TTL_MS,
  };
  const encoded = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret()).update(encoded).digest("hex");
  return { token: `${encoded}.${signature}`, expiresAt: payload.exp };
}

export function verifyDeviceAccessToken(token: string): DeviceAccess | null {
  if (!secret() || !token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", secret()).update(encoded).digest("hex");
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DeviceAccess;
    if (!payload.deviceId || !payload.exp || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function accessFromRequest(request: Request) {
  return verifyDeviceAccessToken(request.headers.get("x-bbqtown-device-token") || "");
}

export function newRefreshToken() {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}
