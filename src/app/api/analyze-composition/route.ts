import { NextRequest, NextResponse } from "next/server";

// ─── Types ───

interface ChampData {
  id: number;
  name: string;
  roles: string[];
}

interface AnalyzeRequest {
  ourBans: ChampData[];
  theirBans: ChampData[];
  ourPicks: ChampData[];
  theirPicks: ChampData[];
  ourSide: "blue" | "red";
  champions: Record<string, { name: string; roles: string[] }>;
}

// ─── Prompt Builder ───

function buildPrompt(body: AnalyzeRequest): string {
  const { ourPicks, theirPicks, ourBans, theirBans, ourSide } = body;

  const label = ourSide === "blue" ? "Azul" : "Rojo";

  // Assign roles by position in array (top, jungle, mid, adc, support)
  const roles = ["Top", "Jungla", "Mid", "ADC", "Support"];

  const ourLines = ourPicks
    .map((c, i) => `- ${roles[i]}: ${c.name}`)
    .join("\n");
  const theirLines = theirPicks
    .map((c, i) => `- ${roles[i]}: ${c.name}`)
    .join("\n");

  const ourBanNames = ourBans.map((c) => c.name).join(", ") || "Ninguno";
  const theirBanNames = theirBans.map((c) => c.name).join(", ") || "Ninguno";

  return `Eres Koki, una streamer mexicana experta en League of Legends, rango Master I, main Twisted Fate. 
Tu equipo (lado ${label}) tiene esta composición:
${ourLines}

El equipo enemigo:
${theirLines}

Bans de nosotros: ${ourBanNames}
Bans de ellos: ${theirBanNames}

Analiza como Koki Coach y proporciona:

1. PUNTOS FUERTES DE TU COMPOSICIÓN
2. PUNTOS DÉBILES DE TU COMPOSICIÓN  
3. SINERGIAS ENTRE CAMPEONES DE TU EQUIPO
4. ANÁLISIS DE LA COMPOSICIÓN ENEMIGA (sus fortalezas y debilidades)
5. ESTRATEGIA RECOMENDADA (teamfight, split push, pick, siege, etc.)
6. DESARROLLO DEL JUEGO (early, mid, late game)
7. CÓMO JUGAR LAS PELEAS EN EQUIPO
8. CONSEJOS FINALES

Importante: Si hay campeones nuevos (Mel, Aurora, Ambessa, etc.), explica brevemente cómo funcionan. 
Sé directa, usa lenguaje mexicano informal pero profesional, nada de markdown ni emojis.`;
}

// ─── Placeholder Analysis (fallback) ───

function generatePlaceholderAnalysis(body: AnalyzeRequest): string {
  const { ourPicks, theirPicks, ourSide } = body;
  const side = ourSide === "blue" ? "Azul" : "Rojo";

  const ourNames = ourPicks.map((c) => c.name).join(", ");
  const theirNames = theirPicks.map((c) => c.name).join(", ");

  return [
    `Análisis de composición - Koki Coach`,
    ``,
    `Equipo ${side} (${ourNames}) vs Enemigo (${theirNames})`,
    ``,
    `1. PUNTOS FUERTES DE TU COMPOSICIÓN`,
    `Tu composición tiene una mezcla equilibrada de daño y utilidad.`,
    `La sinergia entre tus campeones permite jugar peleas organizadas.`,
    ``,
    `2. PUNTOS DÉBILES DE TU COMPOSICIÓN`,
    `Pueden tener problemas si el enemigo logra separarlos en el mapa.`,
    `La composición depende de ejecutar bien las peleas en equipo.`,
    ``,
    `3. SINERGIAS ENTRE CAMPEONES`,
    `Busquen combinar habilidades de control de masas para asegurar eliminaciones.`,
    `El engage en equipo es clave para el éxito de esta composición.`,
    ``,
    `4. ANÁLISIS DE LA COMPOSICIÓN ENEMIGA`,
    `El equipo enemigo tiene amenazas que deben ser neutralizadas.`,
    `Identifica a su carry principal y enfóquense en cerrarlo en peleas.`,
    ``,
    `5. ESTRATEGIA RECOMENDADA`,
    `Teamfight enfocado. Busquen peleas 5v5 donde su composición brilla.`,
    `Eviten dividirse en el mapa a menos que tengan ventaja de visión.`,
    ``,
    `6. DESARROLLO DEL JUEGO`,
    `Early game: jueguen seguro y farmeen.`,
    `Mid game: agrupen y busquen objetivos.`,
    `Late game: su composición escala bien, tengan paciencia.`,
    ``,
    `7. CÓMO JUGAR LAS PELEAS EN EQUIPO`,
    `Esperen el engage de su frontline.`,
    `Los carries deben posicionarse atrás y hacer daño seguro.`,
    `Usen control de masas para castigar a quien se sobreextienda.`,
    ``,
    `8. CONSEJOS FINALES`,
    `Mantengan la moral alta y comuníquense constantemente.`,
    `Si pierden una pelea, reagrupen y busquen una mejor oportunidad.`,
  ].join("\n");
}

// ─── Helpers ───

async function tryOpenAIEndpoint(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("http://127.0.0.1:3007/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "opencode-go/deepseek-v4-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("json")) return null;

    const data = await res.json();
    const text =
      data?.choices?.[0]?.message?.content ||
      data?.message?.content ||
      data?.response ||
      null;
    return text;
  } catch {
    return null;
  }
}

/**
 * Try to use opencode CLI via child_process spawn.
 * Falls back to exec (shorter prompts) or spawn for longer ones.
 */
async function tryOpenCodeCLI(prompt: string): Promise<string | null> {
  const { spawn } = await import("child_process");

  return new Promise((resolve) => {
    const proc = spawn(
      "/home/ubuntu/.opencode/bin/opencode",
      [
        "run",
        "--model",
        "opencode-go/deepseek-v4-flash",
        "--no-interactive",
        prompt,
      ],
      {
        cwd: "/home/ubuntu/lol-team-builder",
        timeout: 60000,
        env: { ...process.env },
      }
    );

    let output = "";
    let errorOut = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      errorOut += chunk.toString();
    });

    proc.on("close", (code: number | null) => {
      if (code === 0 && output.trim()) {
        resolve(output.trim());
      } else {
        resolve(null);
      }
    });

    proc.on("error", () => {
      resolve(null);
    });
  });
}

// ─── Route ───

export async function POST(req: NextRequest) {
  try {
    const body: AnalyzeRequest = await req.json();

    // Validate
    if (!body.ourPicks || !body.theirPicks) {
      return NextResponse.json(
        { error: "Faltan datos de picks" },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(body);

    // Strategy 1: Try OpenAI-compatible endpoint on port 3007
    let analysis = await tryOpenAIEndpoint(prompt);

    // Strategy 2: Try opencode CLI if OpenAI endpoint failed
    if (!analysis) {
      analysis = await tryOpenCodeCLI(prompt);
    }

    // Strategy 3: Use generated placeholder analysis
    if (!analysis) {
      analysis = generatePlaceholderAnalysis(body);
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Koki Coach API error:", error);
    return NextResponse.json(
      { analysis: generatePlaceholderAnalysis({ ourPicks: [], theirPicks: [], ourBans: [], theirBans: [], ourSide: "blue", champions: {} })}
    );
  }
}
