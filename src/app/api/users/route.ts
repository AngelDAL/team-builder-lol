import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        summonerName: true,
        tag: true,
        displayName: true,
        primaryRole: true,
        profileIconId: true,
        createdAt: true,
        _count: { select: { champions: true, compositions: true } },
      },
      orderBy: { summonerName: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = getTokenFromRequest(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { primaryRole } = await req.json();

    await prisma.user.update({
      where: { id: user.userId },
      data: { primaryRole: primaryRole || "" },
    });

    return NextResponse.json({ message: "Rol actualizado", primaryRole });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
