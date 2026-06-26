import { NextRequest, NextResponse } from "next/server"
import { runTracePack } from "@/lib/runner"
import { readJson, saveJson } from "@/lib/storage"
import type { TracePack } from "@/lib/types"

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tracePack = await readJson<TracePack>("tracepacks", params.id)
    const run = await runTracePack(tracePack)
    await saveJson("runs", run.id, run)
    return NextResponse.json({ run })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not run TracePack" }, { status: 500 })
  }
}
