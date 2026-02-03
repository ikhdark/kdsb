import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const res = await fetch(
    `https://website-backend.w3champions.com/api/players/global-search?search=${encodeURIComponent(q)}`,
    { cache: "no-store" }
  );

  const json = await res.json();

  return NextResponse.json(json ?? []);
}
