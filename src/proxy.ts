import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(_req: NextRequest) {
  const res = NextResponse.next();

  // Prevent Cloudflare and CDNs from caching dynamic content
  res.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.headers.set("CDN-Cache-Control", "no-cache");
  res.headers.set("Pragma", "no-cache");

  return res;
}

export const config = {
  matcher: [
    // Apply to all routes except static files (_next/static, _next/image, favicon.ico)
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
