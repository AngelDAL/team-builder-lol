import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  const authUser = getTokenFromRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const targetUserId = parseInt(searchParams.get("userId") || "");

    // If userId param is provided, fetch that user's champions (for composition building)
    // Otherwise, fetch the authenticated user's champions
    const userId = targetUserId || authUser.userId;

    const userChamps = await prisma.userChampion.findMany({
      where: { userId },
      include: { champion: true },
      orderBy: { champion: { name: "asc" } },
    });

    return NextResponse.json({
      champions: userChamps.map((uc) => uc.champion),
    });
  } catch (error) {
    console.error("Error fetching user champions:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { championIds } = await req.json();

    if (!Array.isArray(championIds) || championIds.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de championIds" },
        { status: 400 }
      );
    }

    // Verify champions exist
    const existingChamps = await prisma.champion.findMany({
      where: { id: { in: championIds } },
    });

    if (existingChamps.length !== championIds.length) {
      return NextResponse.json(
        { error: "Algunos campeones no existen" },
        { status: 400 }
      );
    }

    // Add champions to user's pool
    const data = championIds.map((championId: number) => ({
      userId: user.userId,
      championId,
    }));

    const result = await prisma.userChampion.createMany({
      data,
      skipDuplicates: true,
    });

    return NextResponse.json({
      message: `Se agregaron ${result.count} campeones`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error adding champions:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = getTokenFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const championId = parseInt(searchParams.get("championId") || "");

    if (!championId) {
      return NextResponse.json(
        { error: "Se requiere championId" },
        { status: 400 }
      );
    }

    await prisma.userChampion.deleteMany({
      where: {
        userId: user.userId,
        championId,
      },
    });

    return NextResponse.json({ message: "Campeón removido" });
  } catch (error) {
    console.error("Error removing champion:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
