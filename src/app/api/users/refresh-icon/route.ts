import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest } from "@/lib/middleware";

const RIOT_KEY = process.env.RIOT_API_KEY || "";

async function fetchProfileIcon(summonerName: string, tag: string): Promise<number | null> {
  try {
    if (!RIOT_KEY) return null;
    // Get PUUID from AccountV1
    const accountRes = await fetch(
      `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${encodeURIComponent(tag)}`,
      { headers: { "X-Riot-Token": RIOT_KEY } }
    );
    if (!accountRes.ok) return null;
    const account = await accountRes.json();
    const puuid = account.puuid;

    // Try LAS (la1) first, then LAN (la2)
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
  const user = getTokenFromRequest(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { summonerName, tag } = await req.json();
    const name = summonerName || user.summonerName;
    const tagLine = tag || user.tag;

    const iconId = await fetchProfileIcon(name, tagLine);
    if (!iconId) {
      return NextResponse.json({ error: "No se encontró el invocador" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: user.userId },
      data: { profileIconId: iconId },
    });

    const iconUrl = `/api/assets/profile-icon/${iconId}.png`;
    return NextResponse.json({ message: "Icono actualizado", profileIconId: iconId, iconUrl });
  } catch (error) {
    console.error("Refresh icon error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
