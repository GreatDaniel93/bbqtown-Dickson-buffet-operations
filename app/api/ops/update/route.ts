export const dynamic = "force-dynamic";

const REPO = "GreatDaniel93/bbqtown-Dickson-buffet-operations";

export async function GET() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "BBQTown-Ops-Update-Service",
      },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      if (response.status === 404) return Response.json({ available: false });
      throw new Error(`GitHub release lookup failed (${response.status})`);
    }
    const release = await response.json() as {
      tag_name?: string;
      name?: string;
      published_at?: string;
      assets?: Array<{ name?: string; browser_download_url?: string; size?: number }>;
    };
    const versionCode = Number(String(release.tag_name || "").match(/ops-v(\d+)/)?.[1] || 0);
    const asset = (release.assets || []).find((item) => item.name === "BBQTown-Dickson-Ops.apk");
    if (!versionCode || !asset?.browser_download_url) return Response.json({ available: false });
    return Response.json({
      available: true,
      versionCode,
      versionName: release.name || release.tag_name || `Build ${versionCode}`,
      publishedAt: release.published_at || "",
      downloadUrl: asset.browser_download_url,
      size: Number(asset.size || 0),
    }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    console.error("update metadata failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Update lookup failed" }, { status: 502 });
  }
}
