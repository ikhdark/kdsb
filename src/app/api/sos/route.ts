import { NextResponse } from "next/server"
import { getLiveSoS } from "@/lib/liveSoSCache"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const players: string[] = body.players ?? []

    const result: Record<string, number | null> = {}

    await Promise.all(
      players.map(async (p) => {
        const sos = await getLiveSoS(p)
        result[p.toLowerCase()] = sos
      })
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Live SoS API error:", error)

    return NextResponse.json(
      { error: "Failed to compute SoS" },
      { status: 500 }
    )
  }
}