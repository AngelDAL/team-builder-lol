import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest } from "@/lib/middleware";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const compId = parseInt(id);
    const { slotId, championId } = await req.json();

    if (!slotId || !championId) {
      return NextResponse.json(
        { error: "Se requieren slotId y championId" },
        { status: 400 }
      );
    }

    // Verify composition exists
    const composition = await prisma.teamComposition.findUnique({
      where: { id: compId },
    });
    if (!composition) {
      return NextResponse.json(
        { error: "Composición no encontrada" },
        { status: 404 }
      );
    }

    // Verify slot belongs to this composition
    const slot = await prisma.teamCompositionSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot || slot.compositionId !== compId) {
      return NextResponse.json(
        { error: "Slot no pertenece a esta composición" },
        { status: 400 }
      );
    }

    // Verify champion exists
    const champion = await prisma.champion.findUnique({
      where: { id: championId },
    });
    if (!champion) {
      return NextResponse.json(
        { error: "Campeón no encontrado" },
        { status: 404 }
      );
    }

    // Prevent duplicates
    const existing = await prisma.slotSubstitute.findUnique({
      where: { slotId_championId: { slotId, championId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Este sustituto ya existe" },
        { status: 409 }
      );
    }

    // Get current max sortOrder for this slot
    const maxOrder = await prisma.slotSubstitute.findFirst({
      where: { slotId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const substitute = await prisma.slotSubstitute.create({
      data: {
        slotId,
        championId,
        userId: slot.userId,
        sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
      },
      include: {
        champion: true,
      },
    });

    // Notify WS
    try {
      fetch("http://localhost:3006/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "data_changed",
          entity: "composition",
          compositionId: compId,
        }),
      }).catch(() => {});
    } catch {}

    return NextResponse.json({ substitute }, { status: 201 });
  } catch (error) {
    console.error("Error adding substitute:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const compId = parseInt(id);
    const { slotId, championId } = await req.json();

    if (!slotId || !championId) {
      return NextResponse.json(
        { error: "Se requieren slotId y championId" },
        { status: 400 }
      );
    }

    // Verify composition exists
    const composition = await prisma.teamComposition.findUnique({
      where: { id: compId },
    });
    if (!composition) {
      return NextResponse.json(
        { error: "Composición no encontrada" },
        { status: 404 }
      );
    }

    const substitute = await prisma.slotSubstitute.findUnique({
      where: { slotId_championId: { slotId, championId } },
    });
    if (!substitute) {
      return NextResponse.json(
        { error: "Sustituto no encontrado" },
        { status: 404 }
      );
    }

    await prisma.slotSubstitute.delete({
      where: { id: substitute.id },
    });

    // Notify WS
    try {
      fetch("http://localhost:3006/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "data_changed",
          entity: "composition",
          compositionId: compId,
        }),
      }).catch(() => {});
    } catch {}

    return NextResponse.json({ message: "Sustituto eliminado" });
  } catch (error) {
    console.error("Error removing substitute:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
