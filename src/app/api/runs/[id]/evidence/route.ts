import { readFile } from "fs/promises"
import { NextResponse } from "next/server"
import { readJson } from "@/lib/storage"
import type { RunRecord } from "@/lib/types"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const run = await readJson<RunRecord>("runs", params.id)
    const screenshotPath = run.evidence?.screenshotPath
    if (!screenshotPath) return NextResponse.json({ error: "No screenshot evidence" }, { status: 404 })

    const image = await readFile(screenshotPath)
    return new NextResponse(image, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store"
      }
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Evidence not found" }, { status: 404 })
  }
}
