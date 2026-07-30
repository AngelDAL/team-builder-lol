import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";

const CACHE_DIR = path.join(process.cwd(), "data", "asset-cache", "champion");

export async function POST(_req: NextRequest) {
  try {
    const res = await fetch(
      "https://ddragon.leagueoflegends.com/cdn/15.10.1/data/en_US/champion.json"
    );
    const data = await res.json();
    const champions = Object.values(data.data) as any[];

    const formatted = champions.map((c: any) => ({
      championId: parseInt(c.key),
      name: c.name,
      title: c.title,
      // Use local proxy URL
      imageUrl: `/api/assets/champion-icon/${c.key}.png`,
      tags: (c.tags || []).join(","),
    }));

    // Upsert champions, pre-cache images
    fs.mkdirSync(CACHE_DIR, { recursive: true });

    for (const champ of formatted) {
      await prisma.champion.upsert({
        where: { championId: champ.championId },
        update: { name: champ.name, title: champ.title, imageUrl: champ.imageUrl, tags: champ.tags },
        create: champ,
      });

      // Pre-cache champion icon from CDragon
      const cdUrl = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${champ.championId}.png`;
      const cachePath = path.join(CACHE_DIR, `${champ.championId}.png`);
      if (!fs.existsSync(cachePath)) {
        try {
          const imgRes = await fetch(cdUrl, { signal: AbortSignal.timeout(5000) });
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            fs.writeFileSync(cachePath, buf);
          }
        } catch {}
      }
    }

    const count = await prisma.champion.count();
    return NextResponse.json({
      message: `Se cargaron/actualizaron ${count} campeones con tags`,
      count,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Error al cargar campeones" }, { status: 500 });
  }
}
