import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const compId = parseInt(id);

    const composition = await prisma.teamComposition.findUnique({
      where: { id: compId },
      include: {
        creator: {
          select: { id: true, summonerName: true, tag: true, displayName: true },
        },
        slots: {
          include: {
            user: {
              select: { id: true, summonerName: true, tag: true, displayName: true },
            },
            champion: true,
            substitutes: {
              include: { champion: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!composition) {
      return NextResponse.json(
        { error: "Composición no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ composition });
  } catch (error) {
    console.error("Error fetching composition:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
