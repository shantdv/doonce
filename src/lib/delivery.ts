import crypto from "crypto"
import { Resend } from "resend"
import { saveJson } from "./storage"
import type { RunRecord } from "./types"

type Delivery = {
  id: string
  to: string
  subject: string
  body: string
  provider: "resend" | "outbox"
  status: "sent" | "queued"
  createdAt: string
}

function deliveryId() {
  return `delivery_${crypto.randomBytes(8).toString("hex")}`
}

export async function deliverRunEmail(to: string, run: RunRecord) {
  const delivery: Delivery = {
    id: deliveryId(),
    to,
    subject: `DoOnce ${run.status}: ${run.tracePackId}`,
    body: [
      `Run ${run.id} ${run.status}.`,
      "",
      "Outputs:",
      JSON.stringify(run.outputs, null, 2),
      "",
      run.error ? `Error: ${run.error}` : "No errors.",
      run.evidence?.finalUrl ? `Final URL: ${run.evidence.finalUrl}` : ""
    ].join("\n"),
    provider: process.env.RESEND_API_KEY ? "resend" : "outbox",
    status: process.env.RESEND_API_KEY ? "sent" : "queued",
    createdAt: new Date().toISOString()
  }

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.DOONCE_FROM_EMAIL ?? "DoOnce <onboarding@resend.dev>",
      to,
      subject: delivery.subject,
      text: delivery.body
    })
  }

  await saveJson("deliveries", delivery.id, delivery)
  return delivery
}
