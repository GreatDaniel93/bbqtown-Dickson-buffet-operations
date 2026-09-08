import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/",
  "/book",
  "/book.html",
  "/manage-booking.html",
  "/voucher",
  "/voucher/claim",
  "/street-voucher-poster.html",
  "/street-voucher-qr.svg",
  "/bbqtown-logo.png",
  "/bbqtown-logo.svg",
  "/robots.txt",
  "/sitemap.xml",
  "/staff-login",
  "/staff-login/submit",
  "/api/admin/auth",
  "/manifest.webmanifest",
  "/sw.js",
  "/favicon.svg",
  "/file.svg",
  "/globe.svg",
  "/window.svg",
]);

const PUBLIC_BOOKING_IMAGES = new Set([
  "/images/bbq-meat-display.jpg",
  "/images/bbq-sides.jpg",
  "/images/bbq-selection.jpg",
  "/images/bbq-hot-food.jpg",
  "/images/bbq-fried-food.jpg",
]);

const ANDROID_OPS_PAGES = new Set([
  "/ops.html",
  "/tables.html",
  "/manager-dashboard.html",
  "/routines.html",
  "/health.html",
  "/food-safety-advanced.html",
  "/management.html",
  "/inspection-pack.html",
  "/kitchen-prep.html",
]);

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hasStaffSession(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const supplied = request.cookies.get("bbqtown_admin")?.value;
  if (!secret || !supplied) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("bbqtown-dickson-admin-v1")));
  return supplied === expected;
}

function isPublic(pathname: string) {
  return pathname.startsWith("/_next/") || PUBLIC_PATHS.has(pathname) || PUBLIC_BOOKING_IMAGES.has(pathname) || pathname === "/api/vouchers/claim" || pathname === "/api/bookings" || pathname.startsWith("/api/bookings/");
}

function isOpsAndroid(request: NextRequest) {
  return request.headers.get("user-agent")?.includes("BBQTownOpsAndroid") ?? false;
}

function isAndroidOpsRoute(pathname: string) {
  return ANDROID_OPS_PAGES.has(pathname) || pathname.startsWith("/api/ops/") || pathname === "/api/health" || pathname.startsWith("/api/health/");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  // The installed BBQ Town Ops Android shell has its own role-locked navigation.
  // Allow only the operational pages/APIs it needs so a fresh install can work
  // before a browser staff session exists. Customer booking/voucher/staff routes
  // remain blocked by the native shell and are not included here.
  if (isOpsAndroid(request) && isAndroidOpsRoute(pathname)) {
    return NextResponse.next();
  }

  const staffSignedIn = await hasStaffSession(request);
  if (staffSignedIn) {
    // The full operations screen is now app-first. Normal browsers land on a
    // slim staff hub, while the Android APK keeps unrestricted access.
    if (
      pathname === "/ops.html" &&
      !isOpsAndroid(request) &&
      request.nextUrl.searchParams.get("full") !== "1"
    ) {
      const staffHub = request.nextUrl.clone();
      staffHub.pathname = "/staff.html";
      staffHub.search = "";
      return NextResponse.redirect(staffHub);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Staff sign-in required" }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/staff-login";
  login.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
