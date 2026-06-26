import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { saveJson } from "@/lib/storage"
import type { RawTrace } from "@/lib/types"

const rawTraceSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  startedAt: z.string(),
  endedAt: z.string(),
  browser: z.object({
    userAgent: z.string(),
    viewport: z.object({ width: z.number(), height: z.number() })
  }),
  events: z.array(z.any()),
  screenshots: z.array(z.any()).default([]),
  domSnapshots: z.array(z.any()).default([]),
  accessibilitySnapshots: z.array(z.any()).default([]),
  elementSnapshots: z.array(z.any()).default([]),
  networkEvents: z.array(z.any()).default([])
})

export async function POST(request: NextRequest) {
  try {
    const trace = rawTraceSchema.parse(await request.json()) as RawTrace
    await saveJson("traces", trace.id, trace)
    return NextResponse.json({ traceId: trace.id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid trace" }, { status: 400 })
  }
}
