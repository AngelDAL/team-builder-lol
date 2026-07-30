/**
 * Universal asset proxy & cache for Team Ocaso.
 * Caches images in data/asset-cache/, downloads from CDragon/DDragon on first request.
 *
 * URL pattern: /api/assets/{type}/{filename}
 *   - champion-icon/{id}.png    → CDragon champion-icons
 *   - profile-icon/{id}.png     → CDragon v1/profile-icons/{id}.jpg
 *   - champion/{name}.png       → DDragon champion images (by name)
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CACHE_ROOT = path.join(process.cwd(), "data", "asset-cache");
const DD_BASE = "https://ddragon.leagueoflegends.com/cdn/15.10.1/img";
const CD_BASE = "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  if (!slug || slug.length < 2) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  const [assetType, ...rest] = slug;
  const filename = rest.join("/");
  const nameWithoutExt = filename.replace(/\.\w+$/, "");
  const cacheDir = path.join(CACHE_ROOT, assetType);

  // 1. Try cached file
  const cachePath = path.join(cacheDir, filename);
  if (fs.existsSync(cachePath)) return imageResponse(cachePath);

  // 2. Try .jpg variant
  const jpgPath = path.join(cacheDir, `${nameWithoutExt}.jpg`);
  if (fs.existsSync(jpgPath)) return imageResponse(jpgPath);

  // 3. Download and cache
  const { url, ext } = buildUrl(assetType, nameWithoutExt);
  if (!url) return placeholderResponse();

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(cacheDir, { recursive: true });
      const savePath = path.join(cacheDir, `${nameWithoutExt}.${ext}`);
      fs.writeFileSync(savePath, buf);
      return imageResponseFromBuffer(buf, MIME[`.${ext}`] || "image/png");
    }
  } catch {}

  // 4. Fallback: try DDragon for profile icons
  if (assetType === "profile-icon") {
    try {
      const ddUrl = `${DD_BASE}/profileicon/${nameWithoutExt}.png`;
      const res = await fetch(ddUrl, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(path.join(cacheDir, `${nameWithoutExt}.png`), buf);
        return imageResponseFromBuffer(buf, "image/png");
      }
    } catch {}
  }

  return placeholderResponse();
}

function buildUrl(assetType: string, id: string): { url: string | null; ext: string } {
  switch (assetType) {
    case "champion-icon":
      return { url: `${CD_BASE}/v1/champion-icons/${id}.png`, ext: "png" };
    case "champion":
      return { url: `${DD_BASE}/champion/${id}.png`, ext: "png" };
    case "profile-icon":
      return { url: `${CD_BASE}/v1/profile-icons/${id}.jpg`, ext: "jpg" };
    default:
      return { url: null, ext: "png" };
  }
}

function imageResponse(filePath: string): NextResponse {
  const buf = fs.readFileSync(filePath);
  const ct = MIME[path.extname(filePath).toLowerCase()] || "image/png";
  return imageResponseFromBuffer(buf, ct);
}

function imageResponseFromBuffer(buf: Buffer, contentType: string): NextResponse {
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

function placeholderResponse(): NextResponse {
  const pixel = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00,
    0x02, 0x00, 0x01, 0x77, 0x2b, 0x0f, 0xba, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
  return new NextResponse(pixel, {
    headers: { "Content-Type": "image/png" },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
