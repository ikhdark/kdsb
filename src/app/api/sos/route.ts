import { NextResponse } from "next/server"
import { getSoSMap } from "@/lib/sosCache"

export async function POST(req: Request) {
  try {
    const { players } = await req.json()

    if (!Array.isArray(players)) {
      return NextResponse.json({})
    }

    const sosMap = await getSoSMap()

    const result: Record<string, number> = {}

    for (const tag of players) {
      const key = String(tag).toLowerCase()
      const value = sosMap.get(key)
      if (value != null) {
        result[key] = value
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error("SOS API error:", err)
    return NextResponse.json({}, { status: 500 })
  }
}