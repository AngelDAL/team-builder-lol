import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest } from "@/lib/middleware";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromRequest(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id } = await context.params;
    const compId = parseInt(id);

    const comp = await prisma.teamComposition.findUnique({ where: { id: compId } });
    if (!comp) {
      return NextResponse.json({ error: "Composición no encontrada" }, { status: 404 });
    }

    // Get or create whiteboard
    let whiteboard = await prisma.whiteboard.findUnique({
      where: { compositionId: compId },
      include: {
        elements: {
          orderBy: { zIndex: "asc" },
          include: {
            owner: { select: { id: true, summonerName: true, tag: true } },
            locker: { select: { id: true, summonerName: true, tag: true } },
          },
        },
      },
    });

    if (!whiteboard) {
      whiteboard = await prisma.whiteboard.create({
        data: { compositionId: compId },
        include: {
          elements: {
            orderBy: { zIndex: "asc" },
            include: {
              owner: { select: { id: true, summonerName: true, tag: true } },
              locker: { select: { id: true, summonerName: true, tag: true } },
            },
          },
        },
      });
    }

    return NextResponse.json({ whiteboard });
  } catch (error) {
    console.error("Error fetching whiteboard:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromRequest(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id } = await context.params;
    const compId = parseInt(id);

    const comp = await prisma.teamComposition.findUnique({ where: { id: compId } });
    if (!comp) {
      return NextResponse.json({ error: "Composición no encontrada" }, { status: 404 });
    }

    const { type, x, y, width, height, content } = await req.json();
    if (!type || typeof x !== "number" || typeof y !== "number") {
      return NextResponse.json({ error: "Faltan campos requeridos (type, x, y)" }, { status: 400 });
    }

    // Ensure whiteboard exists
    let whiteboard = await prisma.whiteboard.findUnique({
      where: { compositionId: compId },
    });
    if (!whiteboard) {
      whiteboard = await prisma.whiteboard.create({
        data: { compositionId: compId },
      });
    }

    // Get next zIndex
    const maxZ = await prisma.whiteboardElement.aggregate({
      where: { whiteboardId: whiteboard.id },
      _max: { zIndex: true },
    });
    const nextZ = (maxZ._max.zIndex ?? -1) + 1;

    const element = await prisma.whiteboardElement.create({
      data: {
        id: crypto.randomUUID(),
        whiteboardId: whiteboard.id,
        type,
        x,
        y,
        width: width ?? 200,
        height: height ?? 100,
        zIndex: nextZ,
        ownerId: user.userId,
        content: content ?? {},
      },
      include: {
        owner: { select: { id: true, summonerName: true, tag: true } },
      },
    });

    return NextResponse.json({ element }, { status: 201 });
  } catch (error) {
    console.error("Error creating element:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
