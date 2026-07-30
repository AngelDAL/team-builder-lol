import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest } from "@/lib/middleware";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; eid: string }> }
) {
  const user = getTokenFromRequest(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id, eid } = await context.params;
    const compId = parseInt(id);

    const comp = await prisma.teamComposition.findUnique({ where: { id: compId } });
    if (!comp) {
      return NextResponse.json({ error: "Composición no encontrada" }, { status: 404 });
    }

    const element = await prisma.whiteboardElement.findUnique({
      where: { id: eid },
      include: { whiteboard: true },
    });

    if (!element || element.whiteboard.compositionId !== compId) {
      return NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.x === "number") updateData.x = body.x;
    if (typeof body.y === "number") updateData.y = body.y;
    if (typeof body.width === "number") updateData.width = body.width;
    if (typeof body.height === "number") updateData.height = body.height;
    if (typeof body.rotation === "number") updateData.rotation = body.rotation;
    if (typeof body.zIndex === "number") updateData.zIndex = body.zIndex;
    if (body.content !== undefined) updateData.content = body.content;

    const updated = await prisma.whiteboardElement.update({
      where: { id: eid },
      data: updateData,
      include: {
        owner: { select: { id: true, summonerName: true, tag: true } },
        locker: { select: { id: true, summonerName: true, tag: true } },
      },
    });

    return NextResponse.json({ element: updated });
  } catch (error) {
    console.error("Error updating element:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; eid: string }> }
) {
  const user = getTokenFromRequest(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id, eid } = await context.params;
    const compId = parseInt(id);

    const comp = await prisma.teamComposition.findUnique({ where: { id: compId } });
    if (!comp) {
      return NextResponse.json({ error: "Composición no encontrada" }, { status: 404 });
    }

    const element = await prisma.whiteboardElement.findUnique({
      where: { id: eid },
      include: { whiteboard: true },
    });

    if (!element || element.whiteboard.compositionId !== compId) {
      return NextResponse.json({ error: "Elemento no encontrado" }, { status: 404 });
    }

    await prisma.whiteboardElement.delete({ where: { id: eid } });

    return NextResponse.json({ message: "Elemento eliminado" });
  } catch (error) {
    console.error("Error deleting element:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
