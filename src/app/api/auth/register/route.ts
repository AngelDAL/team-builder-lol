import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RIOT_KEY = process.env.RIOT_API_KEY || "";

async function fetchProfileIcon(summonerName: string, tag: string): Promise<number | null> {
  try {
    if (!RIOT_KEY) return null;
    const accountRes = await fetch(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${encodeURIComponent(tag)}`,
      { headers: { "X-Riot-Token": RIOT_KEY } }
    );
    if (!accountRes.ok) return null;
    const account = await accountRes.json();
    const puuid = account.puuid;
    for (const region of ["la1", "la2"]) {
      const res = await fetch(
        `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        { headers: { "X-Riot-Token": RIOT_KEY } }
      );
      if (res.ok) {
        const data = await res.json();
        return data.profileIconId || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { summonerName, tag } = await req.json();
    if (!summonerName || !tag) {
      return NextResponse.json({ error: "Faltan campos: summonerName, tag" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { summonerName_tag: { summonerName, tag } },
    });

    if (existing) {
      const { generateToken } = await import("@/lib/auth");
      const token = generateToken({
        userId: existing.id,
        summonerName: existing.summonerName,
        tag: existing.tag,
      });

      return NextResponse.json({
        message: "Bienvenido de vuelta",
        token,
        user: {
          id: existing.id,
          summonerName: existing.summonerName,
          tag: existing.tag,
          displayName: existing.displayName,
          profileIconId: existing.profileIconId,
        },
      });
    }

    // Register new user, fetch icon in background
    const user = await prisma.user.create({
      data: {
        summonerName,
        tag,
        displayName: `${summonerName}#${tag}`,
      },
    });

    // Background fetch
    fetchProfileIcon(summonerName, tag).then(async (iconId) => {
      if (iconId) {
        await prisma.user.update({ where: { id: user.id }, data: { profileIconId: iconId } });
      }
    }).catch(() => {});

    const { generateToken } = await import("@/lib/auth");
    const token = generateToken({
      userId: user.id,
      summonerName: user.summonerName,
      tag: user.tag,
    });

    return NextResponse.json(
      {
        message: "¡Cuenta creada!",
        token,
        user: {
          id: user.id,
          summonerName: user.summonerName,
          tag: user.tag,
          displayName: user.displayName,
          profileIconId: null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
