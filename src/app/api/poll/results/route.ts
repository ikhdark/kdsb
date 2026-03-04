import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis = Redis.fromEnv();

export async function GET() {
  const results = await redis.hgetall("sos_poll");
  return NextResponse.json(results || {});
}