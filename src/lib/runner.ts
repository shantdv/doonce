import crypto from "crypto"
import { mkdir } from "fs/promises"
import path from "path"
import { RunRecord, SelectorCandidate, SuccessPredicate, TracePack, TraceStep } from "./types"

function runId() {
  return `run_${crypto.randomBytes(8).toString("hex")}`
}

function locatorFromCandidate(page: import("@playwright/test").Page, candidate: SelectorCandidate) {
  if (candidate.strategy === "text") return page.getByText(candidate.value, { exact: false })
  if (candidate.strategy === "label") return page.getByLabel(candidate.value)
  if (candidate.strategy === "role") return page.getByRole("button", { name: new RegExp(candidate.value, "i") })
  if (candidate.strategy === "xpath") return page.locator(`xpath=${candidate.value}`)
  return page.locator(candidate.value)
}

async function resolveElement(page: import("@playwright/test").Page, selectorLadder: SelectorCandidate[]) {
  const candidates = [...selectorLadder].sort((a, b) => b.stabilityScore - a.stabilityScore)

  for (const candidate of candidates) {
    try {
      const locator = locatorFromCandidate(page, candidate)
      await locator.first().waitFor({ timeout: 3000 })
      if ((await locator.count()) > 0) return locator.first()
    } catch {
      continue
    }
  }

  throw new Error("No selector candidate resolved")
}

async function verifyPredicates(page: import("@playwright/test").Page, predicates: SuccessPredicate[], outputs: Record<string, unknown>) {
  for (const predicate of predicates) {
    if (predicate.type === "url_matches" && !page.url().includes(predicate.value)) {
      return { ok: false, error: `URL did not match ${predicate.value}` }
    }

    if (predicate.type === "element_visible") {
      try {
        await page.locator(predicate.value).first().waitFor({ timeout: 1500 })
      } catch {
        return { ok: false, error: `Element not visible: ${predicate.value}` }
      }
    }

    if (predicate.type === "output_schema_valid" && (outputs[predicate.value] === undefined || outputs[predicate.value] === "")) {
      return { ok: false, error: `Output missing: ${predicate.value}` }
    }
  }

  return { ok: true as const }
}

async function executeStep(page: import("@playwright/test").Page, step: TraceStep, outputs: Record<string, unknown>) {
  if (step.action.type === "goto") {
    await page.goto(step.action.urlTemplate, { waitUntil: "domcontentloaded" })
    return
  }

  if (step.action.type === "waitFor") {
    await page.waitForTimeout(1000)
    return
  }

  const element = await resolveElement(page, step.selectorLadder)

  if (step.action.type === "click") {
    await element.click()
  }

  if (step.action.type === "fill") {
    await element.fill(step.action.valueTemplate)
  }

  if (step.action.type === "extract") {
    outputs[step.action.outputKey] = (await element.textContent())?.trim() ?? ""
  }
}

export async function runTracePack(pack: TracePack): Promise<RunRecord> {
  const startedAt = new Date().toISOString()
  const id = runId()
  const outputs: Record<string, unknown> = {}
  const evidenceDir = path.join(process.cwd(), "data", "evidence", id)
  await mkdir(evidenceDir, { recursive: true })

  const { chromium } = await import("@playwright/test")
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  let currentStep: TraceStep | undefined

  try {
    for (const step of pack.steps) {
      currentStep = step
      await executeStep(page, step, outputs)
      const verified = await verifyPredicates(page, step.successPredicates, outputs)

      if (!verified.ok) {
        throw new Error(`Verification failed at ${step.id}: ${verified.error}`)
      }
    }

    const screenshotPath = path.join(evidenceDir, "final.png")
    await page.screenshot({ path: screenshotPath, fullPage: true })
    await browser.close()

    return {
      id,
      tracePackId: pack.id,
      status: "passed",
      startedAt,
      endedAt: new Date().toISOString(),
      outputs,
      evidence: { screenshotPath, finalUrl: page.url() }
    }
  } catch (error) {
    const screenshotPath = path.join(evidenceDir, "failure.png")
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)
    await browser.close()

    return {
      id,
      tracePackId: pack.id,
      status: "failed",
      startedAt,
      endedAt: new Date().toISOString(),
      outputs,
      error: error instanceof Error ? error.message : "Unknown run failure",
      failedStepId: currentStep?.id,
      failedStepIntent: currentStep?.intent,
      evidence: { screenshotPath, finalUrl: page.url() }
    }
  }
}
