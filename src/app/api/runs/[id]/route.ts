import { NextResponse } from "next/server"
import { readJson } from "@/lib/storage"
import type { RunRecord } from "@/lib/types"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const run = await readJson<RunRecord>("runs", params.id)
    return NextResponse.json({ run })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Run not found" }, { status: 404 })
  }
}
