import { NextResponse } from "next/server"
import { readJson } from "@/lib/storage"
import type { RawTrace } from "@/lib/types"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const trace = await readJson<RawTrace>("traces", params.id)
    return NextResponse.json({ trace })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trace not found" }, { status: 404 })
  }
}
