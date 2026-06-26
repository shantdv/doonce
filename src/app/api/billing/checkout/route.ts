import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({
    mode: "manual_v0",
    message: "Stripe checkout is intentionally stubbed in v0. Add STRIPE_SECRET_KEY and price IDs to activate billing.",
    offer: "$49 setup + $29/month per 3 monitors"
  })
}
