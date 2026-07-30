import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  try {
    const champions = await prisma.champion.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ champions });
  } catch (error) {
    console.error("Champions fetch error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
