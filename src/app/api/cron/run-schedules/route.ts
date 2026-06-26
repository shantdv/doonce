import { NextResponse } from "next/server"
import { deliverRunEmail } from "@/lib/delivery"
import { listJson, readJson, saveJson } from "@/lib/storage"
import { runTracePack } from "@/lib/runner"
import type { TracePack } from "@/lib/types"

type Schedule = {
  id: string
  tracePackId: string
  cadence: "daily" | "weekly"
  time: string
  email: string
  active: boolean
  createdAt: string
}

export async function POST() {
  const schedules = await listJson<Schedule>("schedules")
  const active = schedules.filter((schedule) => schedule.active)
  const results = []

  for (const schedule of active) {
    try {
      const tracePack = await readJson<TracePack>("tracepacks", schedule.tracePackId)
      const run = await runTracePack(tracePack)
      await saveJson("runs", run.id, run)
      const delivery = await deliverRunEmail(schedule.email, run)
      results.push({ scheduleId: schedule.id, runId: run.id, status: run.status, deliveryId: delivery.id })
    } catch (error) {
      results.push({
        scheduleId: schedule.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown schedule failure"
      })
    }
  }

  return NextResponse.json({ ran: results.length, results })
}
