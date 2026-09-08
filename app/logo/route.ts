import { BBQTOWN_LOGO_DATA_URL } from "../logo-data";

export const runtime = "nodejs";

export async function GET() {
  const base64 = BBQTOWN_LOGO_DATA_URL.split(",")[1] || "";
  const image = Buffer.from(base64, "base64");

  return new Response(image, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
      "Content-Length": String(image.length),
    },
  });
}
