import crypto from "crypto"
import { OutputMark, RawTrace, TracePack, TraceStep, tracePackSchema } from "./types"

const forbiddenActions = ["purchase", "delete", "send_message", "submit_payment", "change_settings"] as const

function id(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return "unknown"
  }
}

function selectorLadder(selectorHint: string, text?: string) {
  const ladder = []

  if (text && text.trim()) {
    ladder.push({ strategy: "text" as const, value: text.trim(), stabilityScore: 0.78 })
  }

  if (selectorHint.includes("[aria-label")) {
    ladder.push({ strategy: "css" as const, value: selectorHint, stabilityScore: 0.86 })
  } else if (selectorHint) {
    ladder.push({ strategy: "css" as const, value: selectorHint, stabilityScore: 0.52 })
  }

  return ladder.length > 0 ? ladder : [{ strategy: "visual" as const, value: "last-known-click-location", stabilityScore: 0.25 }]
}

export function compileTracePack(trace: RawTrace, outputs: OutputMark[], name = "Recorded monitor"): TracePack {
  const navigationEvents = trace.events.filter((event) => event.type === "navigate")
  const allowedDomains = Array.from(new Set(navigationEvents.map((event) => domainFromUrl(event.url))))
  const steps: TraceStep[] = []

  for (const event of trace.events) {
    if (event.type === "navigate") {
      steps.push({
        id: id("step"),
        intent: `Open ${domainFromUrl(event.url)}`,
        action: { type: "goto", urlTemplate: event.url },
        selectorLadder: [],
        successPredicates: [{ type: "url_matches", value: domainFromUrl(event.url) }],
        failurePolicy: "stop_and_report"
      })
    }

    if (event.type === "click") {
      steps.push({
        id: id("step"),
        intent: event.text ? `Click ${event.text}` : "Click recorded page element",
        action: { type: "click" },
        selectorLadder: selectorLadder(event.selectorHint, event.text),
        successPredicates: [{ type: "element_visible", value: event.selectorHint }],
        failurePolicy: "try_next_selector"
      })
    }

    if (event.type === "input" && event.valueKind !== "secret") {
      steps.push({
        id: id("step"),
        intent: "Fill recorded input",
        action: { type: "fill", valueTemplate: event.value ?? "" },
        selectorLadder: selectorLadder(event.selectorHint),
        successPredicates: [{ type: "element_visible", value: event.selectorHint }],
        failurePolicy: "retry_step"
      })
    }
  }

  for (const output of outputs) {
    steps.push({
      id: id("step"),
      intent: `Extract ${output.label}`,
      action: { type: "extract", outputKey: output.label },
      selectorLadder: selectorLadder(output.selectorHint, output.sampleValue),
      successPredicates: [{ type: "output_schema_valid", value: output.label }],
      failurePolicy: "stop_and_report"
    })
  }

  const pack: TracePack = {
    id: id("pack"),
    traceId: trace.id,
    userId: trace.userId,
    name,
    version: 1,
    risk: {
      level: "read_only",
      allowedDomains,
      forbiddenActions: [...forbiddenActions]
    },
    inputs: [],
    outputs: outputs.map((output) => ({
      key: output.label,
      type: output.type,
      sampleValue: output.sampleValue,
      validationRegex: output.type === "currency" ? "^[$€£]?[0-9,.]+$" : undefined
    })),
    steps,
    runtime: {
      engine: "playwright",
      timeoutMs: 60000,
      retryBudget: 1,
      llmRepairPolicy: "on_validation_failure_only"
    },
    createdAt: new Date().toISOString()
  }

  return tracePackSchema.parse(pack)
}
