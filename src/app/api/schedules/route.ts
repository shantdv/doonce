import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { saveJson } from "@/lib/storage"

const scheduleSchema = z.object({
  tracePackId: z.string(),
  cadence: z.enum(["daily", "weekly"]),
  time: z.string(),
  email: z.string().email()
})

export async function POST(request: NextRequest) {
  try {
    const body = scheduleSchema.parse(await request.json())
    const schedule = {
      id: `schedule_${crypto.randomBytes(8).toString("hex")}`,
      ...body,
      active: true,
      createdAt: new Date().toISOString()
    }
    await saveJson("schedules", schedule.id, schedule)
    return NextResponse.json({ schedule })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create schedule" }, { status: 400 })
  }
}
