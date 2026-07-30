import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  const user = getTokenFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const compositions = await prisma.teamComposition.findMany({
      orderBy: { createdAt: "desc" },
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

    return NextResponse.json({ compositions });
  } catch (error) {
    console.error("Error fetching compositions:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getTokenFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { name, description, slots, draft } = await req.json();

    if (!name || !slots || !Array.isArray(slots)) {
      return NextResponse.json(
        { error: "Se requiere name y slots" },
        { status: 400 }
      );
    }

    const isDraft = draft === true;

    // Full composition requires exactly 5 valid slots
    if (!isDraft && slots.length !== 5) {
      return NextResponse.json(
        { error: "Se requieren 5 slots (top, jungle, mid, adc, support)" },
        { status: 400 }
      );
    }

    // Validate each slot — skip for drafts
    if (!isDraft) {
      const validRoles = ["top", "jungle", "mid", "adc", "support"];
      for (const slot of slots) {
        if (!validRoles.includes(slot.role) || !slot.userId || !slot.championId) {
          return NextResponse.json(
            { error: "Cada slot necesita role, userId y championId válidos" },
            { status: 400 }
          );
        }
      }
      // Check role uniqueness (solo para drafts se permiten duplicados parciales)
      const roles = slots.map((s: any) => s.role);
      if (new Set(roles).size !== slots.length) {
        return NextResponse.json(
          { error: "No puede haber roles duplicados" },
          { status: 400 }
        );
      }
      // Verify each user actually has that champion in their pool
      for (const slot of slots) {
        const hasChamp = await prisma.userChampion.findFirst({
          where: {
            userId: slot.userId,
            championId: slot.championId,
          },
        });
        if (!hasChamp) {
          const champ = await prisma.champion.findUnique({
            where: { id: slot.championId },
          });
          return NextResponse.json(
            {
              error: `El usuario ${slot.userId} no tiene a ${champ?.name || "ese campeón"} en su pool`,
            },
            { status: 400 }
          );
        }
      }
    }

    const composition = await prisma.teamComposition.create({
      data: {
        name,
        description: description || null,
        createdBy: user.userId,
        slots: {
          create: slots.map((slot: any) => ({
            role: slot.role,
            userId: slot.userId,
            championId: slot.championId,
          })),
        },
      },
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

    return NextResponse.json({ composition }, { status: 201 });
  } catch (error) {
    console.error("Error creating composition:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = getTokenFromRequest(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get("id") || "");
    if (!id) return NextResponse.json({ error: "Se requiere id" }, { status: 400 });

    const comp = await prisma.teamComposition.findUnique({ where: { id } });
    if (!comp) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const { name, description, slots } = await req.json();

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;

    if (slots && Array.isArray(slots)) {
      // Delete existing slots and recreate
      await prisma.teamCompositionSlot.deleteMany({ where: { compositionId: id } });
      await prisma.teamCompositionSlot.createMany({
        data: slots.map((s: any) => ({
          compositionId: id,
          role: s.role,
          userId: s.userId,
          championId: s.championId,
        })),
      });
    }

    if (Object.keys(data).length > 0) {
      await prisma.teamComposition.update({ where: { id }, data });
    }

    const updated = await prisma.teamComposition.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, summonerName: true, tag: true } },
        slots: {
          include: {
            user: { select: { id: true, summonerName: true, tag: true } },
            champion: true,
          },
        },
      },
    });

    return NextResponse.json({ composition: updated });
  } catch (error) {
    console.error("Error updating composition:", error);
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
    const id = parseInt(searchParams.get("id") || "");

    if (!id) {
      return NextResponse.json(
        { error: "Se requiere id de la composición" },
        { status: 400 }
      );
    }

    const comp = await prisma.teamComposition.findUnique({ where: { id } });
    if (!comp) {
      return NextResponse.json(
        { error: "Composición no encontrada" },
        { status: 404 }
      );
    }

    await prisma.teamComposition.delete({ where: { id } });
    return NextResponse.json({ message: "Composición eliminada" });
  } catch (error) {
    console.error("Error deleting composition:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
