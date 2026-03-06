// src/app/api/global-search/route.ts

import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"

/* =====================================================
   Cached Global Search (5 min)
===================================================== */

async function fetchGlobalSearch(query: string) {
  const res = await fetch(
    `https://website-backend.w3champions.com/api/players/global-search?search=${encodeURIComponent(query)}`,
    {
      next: { revalidate: 300 },
    }
  )

  if (!res.ok) return []
  return res.json()
}

const getCachedSearch = (query: string) =>
  unstable_cache(
    () => fetchGlobalSearch(query),
    ["global-search", query],
    { revalidate: 300 }
  )()

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  try {
    const results = await getCachedSearch(q)
    return NextResponse.json(results ?? [])
  } catch {
    return NextResponse.json([])
  }
}