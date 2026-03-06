import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ ok: false });

  try {
    const canonical = await resolveBattleTagViaSearch(q);
    if (!canonical) return NextResponse.json({ ok: false });

    return NextResponse.json({
      ok: true,
      battleTag: canonical,
    });
  } catch {
    return NextResponse.json({ ok: false });
  }
}