import { z } from "zod"

export const selectorCandidateSchema = z.object({
  strategy: z.enum(["role", "label", "text", "css", "xpath", "visual"]),
  value: z.string(),
  stabilityScore: z.number().min(0).max(1)
})

export const successPredicateSchema = z.object({
  type: z.enum(["element_visible", "url_matches", "text_matches", "output_schema_valid", "network_success"]),
  value: z.string()
})

export const traceStepSchema = z.object({
  id: z.string(),
  intent: z.string(),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("goto"), urlTemplate: z.string() }),
    z.object({ type: z.literal("click") }),
    z.object({ type: z.literal("fill"), valueTemplate: z.string() }),
    z.object({ type: z.literal("waitFor") }),
    z.object({ type: z.literal("extract"), outputKey: z.string() })
  ]),
  selectorLadder: z.array(selectorCandidateSchema),
  successPredicates: z.array(successPredicateSchema),
  failurePolicy: z.enum(["try_next_selector", "retry_step", "stop_and_report"])
})

export const tracePackSchema = z.object({
  id: z.string(),
  traceId: z.string(),
  userId: z.string(),
  name: z.string(),
  version: z.number(),
  risk: z.object({
    level: z.literal("read_only"),
    allowedDomains: z.array(z.string()),
    forbiddenActions: z.array(z.enum(["purchase", "delete", "send_message", "submit_payment", "change_settings"]))
  }),
  inputs: z.array(z.object({
    key: z.string(),
    type: z.enum(["url", "text", "number"]),
    required: z.boolean(),
    defaultValue: z.string().optional()
  })),
  outputs: z.array(z.object({
    key: z.string(),
    type: z.enum(["text", "currency", "number", "boolean", "url", "date"]),
    sampleValue: z.string(),
    validationRegex: z.string().optional()
  })),
  steps: z.array(traceStepSchema),
  runtime: z.object({
    engine: z.literal("playwright"),
    timeoutMs: z.number(),
    retryBudget: z.number(),
    llmRepairPolicy: z.literal("on_validation_failure_only")
  }),
  createdAt: z.string()
})

export type SelectorCandidate = z.infer<typeof selectorCandidateSchema>
export type SuccessPredicate = z.infer<typeof successPredicateSchema>
export type TraceStep = z.infer<typeof traceStepSchema>
export type TracePack = z.infer<typeof tracePackSchema>

export type TraceEvent =
  | { type: "navigate"; url: string; timestamp: number }
  | { type: "click"; selectorHint: string; text?: string; x: number; y: number; timestamp: number }
  | { type: "input"; selectorHint: string; valueKind: "literal" | "secret" | "variable"; value?: string; timestamp: number }
  | { type: "scroll"; x: number; y: number; timestamp: number }
  | { type: "submit"; selectorHint: string; timestamp: number }
  | { type: "extract_mark"; label: string; selectorHint: string; sampleValue: string; timestamp: number }

export type RawTrace = {
  id: string
  userId: string
  startedAt: string
  endedAt: string
  browser: {
    userAgent: string
    viewport: { width: number; height: number }
  }
  events: TraceEvent[]
  screenshots: Array<{ id: string; capturedAt: number; dataUrl?: string; path?: string }>
  domSnapshots: Array<{ id: string; capturedAt: number; html?: string; path?: string }>
  accessibilitySnapshots: Array<{ id: string; capturedAt: number; tree?: unknown; path?: string }>
  elementSnapshots?: Array<{
    id: string
    capturedAt: number
    elements: Array<{
      selectorHint: string
      text: string
      rect: { x: number; y: number; width: number; height: number }
    }>
  }>
  networkEvents: Array<{ url: string; method: string; status?: number; timestamp: number }>
}

export type OutputMark = {
  label: string
  selectorHint: string
  sampleValue: string
  type: "text" | "currency" | "number" | "boolean" | "url" | "date"
}

export type RunRecord = {
  id: string
  tracePackId: string
  status: "passed" | "failed"
  startedAt: string
  endedAt: string
  outputs: Record<string, unknown>
  error?: string
  failedStepId?: string
  failedStepIntent?: string
  evidence?: {
    screenshotPath?: string
    finalUrl?: string
  }
}
