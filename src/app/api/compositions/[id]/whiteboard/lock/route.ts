import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest } from "@/lib/middleware";

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

    const { elementId, lock } = await req.json();
    if (!elementId || typeof lock !== "boolean") {
      return NextResponse.json({ error: "Se requiere elementId y lock" }, { status: 400 });
    }

    const element = await prisma.whiteboardElement.findUnique({
      where: { id: elementId },
      include: { whiteboard: true },
    });

    if (!element || element.whiteboard.compositionId !== compId) {
      return NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 });
    }

    const updated = await prisma.whiteboardElement.update({
      where: { id: elementId },
      data: {
        lockedBy: lock ? user.userId : null,
        lockedAt: lock ? new Date() : null,
      },
      include: {
        owner: { select: { id: true, summonerName: true, tag: true } },
        locker: { select: { id: true, summonerName: true, tag: true } },
      },
    });

    return NextResponse.json({ element: updated });
  } catch (error) {
    console.error("Error toggling lock:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
