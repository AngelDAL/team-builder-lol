import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "lol-tabtap-secret-koki-mill-2026";

export interface JwtPayload {
  userId: number;
  summonerName: string;
  tag: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
