import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { summonerName, tag } = await req.json();

    if (!summonerName || !tag) {
      return NextResponse.json(
        { error: "Faltan campos: summonerName, tag" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { summonerName_tag: { summonerName, tag } },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado. ¿Ya te registraste?" },
        { status: 404 }
      );
    }

    const token = generateToken({
      userId: user.id,
      summonerName: user.summonerName,
      tag: user.tag,
    });

    return NextResponse.json({
      message: "Inicio de sesión exitoso",
      token,
      user: {
        id: user.id,
        summonerName: user.summonerName,
        tag: user.tag,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
