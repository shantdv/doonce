import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { compileTracePack } from "@/lib/compiler"
import { readJson, saveJson } from "@/lib/storage"
import type { OutputMark, RawTrace } from "@/lib/types"

const requestSchema = z.object({
  traceId: z.string(),
  name: z.string().default("Recorded monitor"),
  outputs: z.array(z.object({
    label: z.string().min(1),
    selectorHint: z.string().min(1),
    sampleValue: z.string().default(""),
    type: z.enum(["text", "currency", "number", "boolean", "url", "date"])
  })).min(1)
})

export async function POST(request: NextRequest) {
  try {
    const body = requestSchema.parse(await request.json())
    const trace = await readJson<RawTrace>("traces", body.traceId)
    const tracePack = compileTracePack(trace, body.outputs as OutputMark[], body.name)
    await saveJson("tracepacks", tracePack.id, tracePack)
    return NextResponse.json({ tracePack })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not compile TracePack" }, { status: 400 })
  }
}
