import { resolveBattleTagViaSearch } from "@/lib/w3cBattleTagResolver";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const input = searchParams.get("q");

  if (!input) {
    return NextResponse.json({ ok: false });
  }

  const canonical = await resolveBattleTagViaSearch(input);

  if (!canonical) {
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({
    ok: true,
    battleTag: canonical,
  });
}
