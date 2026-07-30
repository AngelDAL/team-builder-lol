import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JwtPayload } from "./auth";

export function getTokenFromRequest(req: NextRequest): JwtPayload | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  return verifyToken(token);
}

export function withAuth(
  handler: (
    req: NextRequest,
    user: JwtPayload,
    params: Record<string, string>
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: { params?: Record<string, string> }) => {
    const user = getTokenFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return handler(req, user, context?.params || {});
  };
}
