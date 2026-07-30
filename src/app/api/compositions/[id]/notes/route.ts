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

    // Verify composition exists
    const comp = await prisma.teamComposition.findUnique({ where: { id: compId } });
    if (!comp) {
      return NextResponse.json({ error: "Composición no encontrada" }, { status: 404 });
    }

    const notes = await prisma.compositionNote.findMany({
      where: { compositionId: compId },
      include: {
        user: { select: { id: true, summonerName: true, tag: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Error fetching notes:", error);
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

    // Verify composition exists
    const comp = await prisma.teamComposition.findUnique({ where: { id: compId } });
    if (!comp) {
      return NextResponse.json({ error: "Composición no encontrada" }, { status: 404 });
    }

    const { content, tags } = await req.json();

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Contenido vacío" }, { status: 400 });
    }

    const note = await prisma.compositionNote.create({
      data: {
        compositionId: compId,
        userId: user.userId,
        content: content.trim(),
        tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      },
      include: {
        user: { select: { id: true, summonerName: true, tag: true } },
      },
    });

    // Notify WS
    try {
      fetch("http://localhost:3006/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "data_changed", entity: "notes", compositionId: compId }),
      }).catch(() => {});
    } catch {}

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getTokenFromRequest(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id } = await context.params;
    const compId = parseInt(id);

    // Verify composition exists
    const comp = await prisma.teamComposition.findUnique({ where: { id: compId } });
    if (!comp) {
      return NextResponse.json({ error: "Composición no encontrada" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const noteId = parseInt(searchParams.get("noteId") || "");

    if (!noteId) {
      return NextResponse.json({ error: "Se requiere noteId" }, { status: 400 });
    }

    const note = await prisma.compositionNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    }

    if (note.userId !== user.userId) {
      return NextResponse.json({ error: "No puedes eliminar notas de otro usuario" }, { status: 403 });
    }

    await prisma.compositionNote.delete({ where: { id: noteId } });

    // Notify WS
    try {
      fetch("http://localhost:3006/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "data_changed", entity: "notes", compositionId: compId }),
      }).catch(() => {});
    } catch {}

    return NextResponse.json({ message: "Nota eliminada" });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
