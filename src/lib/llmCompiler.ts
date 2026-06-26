import Anthropic from "@anthropic-ai/sdk"
import { OutputMark, RawTrace, TracePack, tracePackSchema } from "./types"
import { compileTracePack } from "./compiler"

/**
 * Verifies the LLM proposal against the read-only v0 rules. Never mutates the
 * proposal — a violation here means the whole proposal is untrustworthy, so the
 * caller must discard it and fall back to the heuristic draft rather than ship
 * a silently-edited version of what the model returned.
 */
function findReadOnlyViolation(pack: TracePack, allowedDomains: string[]): string | undefined {
  if (pack.risk.level !== "read_only") {
    return `risk.level was "${pack.risk.level}", not "read_only"`
  }

  const allowedSet = new Set(allowedDomains)

  for (const domain of pack.risk.allowedDomains) {
    if (!allowedSet.has(domain)) {
      return `risk.allowedDomains included "${domain}", outside recorded domains ${JSON.stringify(allowedDomains)}`
    }
  }

  for (const step of pack.steps) {
    if (step.action.type === "fill" && allowedSet.size > 0) {
      return `step ${step.id} proposed a fill action, which is not permitted in read-only v0`
    }

    if (step.action.type === "goto") {
      let host: string
      try {
        host = new URL(step.action.urlTemplate).hostname
      } catch {
        return `step ${step.id} had an unparseable goto URL: ${step.action.urlTemplate}`
      }
      if (allowedSet.size > 0 && !allowedSet.has(host)) {
        return `step ${step.id} navigated to "${host}", outside allowed domains ${JSON.stringify(allowedDomains)}`
      }
    }
  }

  return undefined
}

function buildPrompt(
  trace: RawTrace,
  outputs: OutputMark[],
  allowedDomains: string[],
  heuristicDraft: TracePack
) {
  return `You are refining a browser-automation TracePack for a read-only monitoring product. \
You are given the raw recorded trace, the user-marked outputs to extract, the allowed domains, and a \
heuristic draft TracePack already produced by deterministic code. Improve the draft: write clearer \
intents, stronger selector ladders (prefer role/label/text strategies over brittle css when the element \
snapshots support it), and accurate success predicates. \

HARD RULES (violating these makes your output invalid):
- risk.level MUST be "read_only".
- Never propose actions of type other than goto, click, fill, waitFor, extract.
- Never include fill actions for secret-valued inputs.
- allowedDomains MUST stay within: ${JSON.stringify(allowedDomains)}.
- Output ONLY a single JSON object matching the TracePack shape below. No prose, no markdown fences.

TracePack shape:
{
  "id": string, "traceId": string, "userId": string, "name": string, "version": number,
  "risk": { "level": "read_only", "allowedDomains": string[], "forbiddenActions": string[] },
  "inputs": [],
  "outputs": [{ "key": string, "type": "text"|"currency"|"number"|"boolean"|"url"|"date", "sampleValue": string, "validationRegex"?: string }],
  "steps": [{
    "id": string, "intent": string,
    "action": {"type":"goto","urlTemplate":string} | {"type":"click"} | {"type":"fill","valueTemplate":string} | {"type":"waitFor"} | {"type":"extract","outputKey":string},
    "selectorLadder": [{"strategy":"role"|"label"|"text"|"css"|"xpath"|"visual","value":string,"stabilityScore":number}],
    "successPredicates": [{"type":"element_visible"|"url_matches"|"text_matches"|"output_schema_valid"|"network_success","value":string}],
    "failurePolicy": "try_next_selector"|"retry_step"|"stop_and_report"
  }],
  "runtime": {"engine":"playwright","timeoutMs":number,"retryBudget":number,"llmRepairPolicy":"on_validation_failure_only"},
  "createdAt": string
}

RAW TRACE EVENTS:
${JSON.stringify(trace.events)}

ELEMENT SNAPSHOTS:
${JSON.stringify(trace.elementSnapshots ?? [])}

USER-MARKED OUTPUTS:
${JSON.stringify(outputs)}

HEURISTIC DRAFT TRACEPACK:
${JSON.stringify(heuristicDraft)}

Return the improved TracePack JSON now.`
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1] : text
  return JSON.parse(candidate.trim())
}

export async function compileTracePackWithLlm(
  trace: RawTrace,
  outputs: OutputMark[],
  name = "Recorded monitor"
): Promise<{ tracePack: TracePack; source: "llm" | "heuristic"; warning?: string }> {
  const heuristicDraft = compileTracePack(trace, outputs, name)
  const allowedDomains = heuristicDraft.risk.allowedDomains

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { tracePack: heuristicDraft, source: "heuristic", warning: "ANTHROPIC_API_KEY not set; using heuristic compiler" }
  }

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: buildPrompt(trace, outputs, allowedDomains, heuristicDraft) }]
    })

    const textBlock = response.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("LLM returned no text content")
    }

    const proposalJson = extractJson(textBlock.text)
    const validated = tracePackSchema.parse(proposalJson)

    const violation = findReadOnlyViolation(validated, allowedDomains)
    if (violation) {
      throw new Error(`LLM proposal violated read-only v0 rules: ${violation}`)
    }

    return { tracePack: validated, source: "llm" }
  } catch (error) {
    return {
      tracePack: heuristicDraft,
      source: "heuristic",
      warning: `LLM proposal rejected, fell back to heuristic: ${error instanceof Error ? error.message : "unknown error"}`
    }
  }
}
