import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis = Redis.fromEnv();

export async function POST(req: Request) {
  const { option } = await req.json();

  if (!option) {
    return NextResponse.json({ error: "missing option" }, { status: 400 });
  }

  await redis.hincrby("sos_poll", option, 1);

  const results = await redis.hgetall("sos_poll");

  return NextResponse.json(results);
}