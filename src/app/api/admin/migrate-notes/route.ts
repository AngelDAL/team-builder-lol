import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const notes = await prisma.compositionNote.findMany({
      include: { user: { select: { id: true, summonerName: true, tag: true } } },
    });

    const byComp = new Map<number, typeof notes>();
    for (const note of notes) {
      const list = byComp.get(note.compositionId) || [];
      list.push(note);
      byComp.set(note.compositionId, list);
    }

    let created = 0;
    let skipped = 0;

    for (const [compId, compNotes] of byComp) {
      let wb = await prisma.whiteboard.findUnique({ where: { compositionId: compId } });
      if (!wb) {
        wb = await prisma.whiteboard.create({ data: { compositionId: compId } });
      }

      let idx = 0;
      for (const note of compNotes) {
        const elementId = `migrated-${note.id}`;
        const existing = await prisma.whiteboardElement.findUnique({ where: { id: elementId } });
        if (existing) { skipped++; continue; }

        const header = `${note.user.summonerName}#${note.user.tag} \u00b7 ${new Date(note.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;
        const fullContent = `${header}\n\n${note.content}`;

        await prisma.whiteboardElement.create({
          data: {
            id: elementId,
            whiteboardId: wb.id,
            type: "note",
            x: 100 + (idx % 4) * 220,
            y: 100 + Math.floor(idx / 4) * 180,
            width: 200,
            height: 150,
            content: { text: fullContent },
            ownerId: note.userId,
          },
        });

        idx++;
        created++;
      }
    }

    return NextResponse.json({
      ok: true,
      totalNotes: notes.length,
      created,
      skipped,
      message: `Migradas ${created} notas a la pizarra. ${skipped} ya existian.`
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
