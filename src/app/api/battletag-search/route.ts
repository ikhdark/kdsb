// src/app/api/global-search/route.ts

import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"

/* =====================================================
   Cached Global Search (5 min)
===================================================== */

const getCachedSearch = unstable_cache(
  async (query: string) => {
    const res = await fetch(
      `https://website-backend.w3champions.com/api/players/global-search?search=${encodeURIComponent(query)}`,
      {
        next: { revalidate: 300 }, // 5 minutes
      }
    )

    if (!res.ok) return []

    return res.json()
  },
  ["global-search"],
  { revalidate: 300 }
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")

  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const results = await getCachedSearch(q.trim())

  return NextResponse.json(results ?? [])
}