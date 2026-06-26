"use client"

import { useEffect, useMemo, useState } from "react"
import type { MouseEvent } from "react"
import type { OutputMark, RawTrace, RunRecord, TracePack, TraceStep } from "@/lib/types"

const sampleTrace: RawTrace = {
  id: "trace_sample",
  userId: "local_user",
  startedAt: new Date().toISOString(),
  endedAt: new Date().toISOString(),
  browser: { userAgent: "DoOnce sample", viewport: { width: 1280, height: 800 } },
  events: [
    { type: "navigate", url: "https://example.com", timestamp: 1 },
    { type: "click", selectorHint: "h1", text: "Example Domain", x: 140, y: 90, timestamp: 2 }
  ],
  screenshots: [],
  domSnapshots: [],
  accessibilitySnapshots: [],
  networkEvents: []
}

function actionLabel(step: TraceStep) {
  if (step.action.type === "goto") return `Open ${step.action.urlTemplate}`
  if (step.action.type === "extract") return `Extract ${step.action.outputKey}`
  if (step.action.type === "fill") return "Fill text"
  if (step.action.type === "waitFor") return "Wait for page"
  return "Click element"
}

function predicateLabel(step: TraceStep) {
  return step.successPredicates.map((predicate) => `${predicate.type.replaceAll("_", " ")}: ${predicate.value}`).join(", ")
}

function lastScreenshot(trace: RawTrace | null) {
  return trace?.screenshots.at(-1)?.dataUrl
}

function nearestRecordedClick(trace: RawTrace, x: number, y: number) {
  const clicks = trace.events.filter((event) => event.type === "click")
  let best = clicks[0]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const click of clicks) {
    const distance = Math.hypot(click.x - x, click.y - y)
    if (distance < bestDistance) {
      best = click
      bestDistance = distance
    }
  }

  return best
}

function nearestVisibleElement(trace: RawTrace, x: number, y: number) {
  const elements = trace.elementSnapshots?.at(-1)?.elements ?? []
  let best = elements[0]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const element of elements) {
    const centerX = element.rect.x + element.rect.width / 2
    const centerY = element.rect.y + element.rect.height / 2
    const inside =
      x >= element.rect.x &&
      x <= element.rect.x + element.rect.width &&
      y >= element.rect.y &&
      y <= element.rect.y + element.rect.height
    const distance = inside ? 0 : Math.hypot(centerX - x, centerY - y)
    if (distance < bestDistance) {
      best = element
      bestDistance = distance
    }
  }

  return best
}

export default function Home() {
  const [traceText, setTraceText] = useState(JSON.stringify(sampleTrace, null, 2))
  const [trace, setTrace] = useState<RawTrace | null>(null)
  const [traceId, setTraceId] = useState<string>("")
  const [pack, setPack] = useState<TracePack | null>(null)
  const [run, setRun] = useState<RunRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("operator@example.com")
  const [outputs, setOutputs] = useState<OutputMark[]>([])

  const canCompile = useMemo(() => traceId.length > 0 && outputs.length > 0, [traceId, outputs])
  const screenshot = lastScreenshot(trace)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const incomingTraceId = params.get("traceId")
    if (!incomingTraceId) return
    loadTrace(incomingTraceId)
  }, [])

  async function loadTrace(id: string) {
    setBusy(true)
    setMessage("")
    setRun(null)
    setPack(null)

    try {
      const response = await fetch(`/api/traces/${id}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setTrace(data.trace)
      setTraceText(JSON.stringify(data.trace, null, 2))
      setTraceId(data.trace.id)
      setOutputs([])
      setMessage("Trace received from recorder. Click the final screenshot or add output selectors.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load trace")
    } finally {
      setBusy(false)
    }
  }

  async function uploadTrace() {
    setBusy(true)
    setMessage("")
    setRun(null)
    setPack(null)

    try {
      const parsedTrace = JSON.parse(traceText)
      const response = await fetch("/api/traces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedTrace)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setTrace(parsedTrace)
      setTraceId(data.traceId)
      setOutputs([])
      setMessage("Trace uploaded. Click the screenshot to label outputs.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload trace")
    } finally {
      setBusy(false)
    }
  }

  async function compile() {
    setBusy(true)
    setMessage("")
    setRun(null)

    try {
      const response = await fetch("/api/tracepacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traceId, name: "Competitor price monitor", outputs })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setPack(data.tracePack)
      const sourceLabel = data.compiler?.source === "llm" ? "LLM-refined" : "heuristic"
      setMessage(`TracePack compiled (${sourceLabel}). Inspect the steps, then run validation.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not compile TracePack")
    } finally {
      setBusy(false)
    }
  }

  async function validateRun() {
    if (!pack) return
    setBusy(true)
    setMessage("")

    try {
      const response = await fetch(`/api/tracepacks/${pack.id}/run`, { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setRun(data.run)
      setMessage(data.run.status === "passed" ? "Validation passed. This monitor is ready to schedule." : "Validation failed. Review the evidence before repair.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not run TracePack")
    } finally {
      setBusy(false)
    }
  }

  async function schedule() {
    if (!pack) return
    setBusy(true)
    setMessage("")

    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracePackId: pack.id, cadence: "daily", time: "06:00", email })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessage(`Scheduled: daily at 6:00am. Delivery goes to ${data.schedule.email}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create schedule")
    } finally {
      setBusy(false)
    }
  }

  function updateOutput(index: number, patch: Partial<OutputMark>) {
    setOutputs((current) => current.map((output, i) => (i === index ? { ...output, ...patch } : output)))
  }

  function addOutputFromScreenshot(event: MouseEvent<HTMLImageElement>) {
    if (!trace) return
    const rect = event.currentTarget.getBoundingClientRect()
    const scaleX = trace.browser.viewport.width / rect.width
    const scaleY = trace.browser.viewport.height / rect.height
    const x = (event.clientX - rect.left) * scaleX
    const y = (event.clientY - rect.top) * scaleY
    const element = nearestVisibleElement(trace, x, y)
    const click = nearestRecordedClick(trace, x, y)
    const sampleText = element?.text || click?.text || ""
    const selectorHint = element?.selectorHint || click?.selectorHint || "body"
    const fallbackLabel = sampleText.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || `output_${outputs.length + 1}`
    const label = window.prompt("Output label", fallbackLabel)
    if (!label) return

    setOutputs((current) => [
      ...current,
      {
        label,
        selectorHint,
        sampleValue: sampleText,
        type: "text"
      }
    ])
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <p className="brand">DoOnce</p>
        <p className="tagline">A browser task becomes software when a human demonstrates it.</p>
        {["Record", "Capture", "Inspect", "Run", "Deliver"].map((step, index) => (
          <div className="nav-step" key={step}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </aside>

      <main className="main">
        <p className="topline">DoOnce for competitor price monitoring</p>
        <h1>Record a price check. Get tomorrow’s report.</h1>
        <p className="hero-copy">
          Use the Chrome recorder to capture one read-only browser check, label the values you care about, validate the TracePack, and schedule a daily email with screenshot evidence.
        </p>

        <div className="grid">
          <section className="panel wide">
            <h2>1. Record Task</h2>
            <p className="muted">
              Preferred flow: extension popup → Start Recording → do the check → Stop and Send to App. Pasted JSON remains here for development and support.
            </p>
            <div className="actions">
              {traceId && <span className="status">{traceId}</span>}
              {trace && <span className="status">{trace.events.length} events</span>}
            </div>
            <details className="dev-details">
              <summary>Developer trace upload</summary>
              <div className="field">
                <label htmlFor="trace">RawTrace JSON</label>
                <textarea id="trace" value={traceText} onChange={(event) => setTraceText(event.target.value)} />
              </div>
              <button className="button" disabled={busy} onClick={uploadTrace}>Upload Trace</button>
            </details>
          </section>

          <section className="panel wide">
            <h2>2. Mark Outputs</h2>
            <p className="muted">Click the final screenshot near a recorded value, then name the output. You can refine the selector before compiling.</p>
            {screenshot ? (
              <div className="screenshot-frame">
                <img src={screenshot} alt="Final recorded browser screenshot" onClick={addOutputFromScreenshot} />
              </div>
            ) : (
              <div className="empty-shot">No screenshot yet. Send a trace from the extension or upload a sample trace.</div>
            )}
            {outputs.map((output, index) => (
              <div className="output-row" key={`${output.label}-${index}`}>
                <div className="field">
                  <label>Label</label>
                  <input value={output.label} onChange={(event) => updateOutput(index, { label: event.target.value })} />
                </div>
                <div className="field">
                  <label>Selector</label>
                  <input value={output.selectorHint} onChange={(event) => updateOutput(index, { selectorHint: event.target.value })} />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select value={output.type} onChange={(event) => updateOutput(index, { type: event.target.value as OutputMark["type"] })}>
                    <option value="text">Text</option>
                    <option value="currency">Currency</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="url">URL</option>
                    <option value="date">Date</option>
                  </select>
                </div>
                <button className="button ghost" onClick={() => setOutputs((current) => current.filter((_, i) => i !== index))}>Remove</button>
              </div>
            ))}
            <div className="actions">
              <button className="button ghost" onClick={() => setOutputs((current) => [...current, { label: "price", selectorHint: "", sampleValue: "", type: "currency" }])}>Add Output</button>
              <button className="button" disabled={!canCompile || busy} onClick={compile}>Compile TracePack</button>
            </div>
          </section>

          {pack && (
            <section className="panel wide">
              <h2>3. TracePack Inspector</h2>
              <div className="step-list">
                {pack.steps.map((step, index) => (
                  <div className="step-card" key={step.id}>
                    <span className="step-number">{index + 1}</span>
                    <div>
                      <strong>{step.intent}</strong>
                      <p>{actionLabel(step)}</p>
                      <p className="muted">Selectors: {step.selectorLadder.map((selector) => `${selector.strategy} ${selector.value}`).join(" → ") || "none"}</p>
                      <p className="muted">Verification: {predicateLabel(step)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel">
            <h2>4. Test Run</h2>
            <p className="muted">A click only counts when its predicate passes. A run only counts when evidence is saved.</p>
            <div className="actions">
              <button className="button secondary" disabled={!pack || busy} onClick={validateRun}>Run Validation</button>
              {run && <span className={`status ${run.status === "failed" ? "failed" : ""}`}>{run.status}</span>}
            </div>
            {run && <pre>{JSON.stringify(run.outputs, null, 2)}</pre>}
          </section>

          <section className="panel">
            <h2>5. Deliver</h2>
            <p className="muted">Email is the first real delivery path. Sheets can come after this loop sells.</p>
            <div className="field">
              <label htmlFor="email">Report email</label>
              <input id="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <button className="button" disabled={!pack || run?.status !== "passed" || busy} onClick={schedule}>Run Daily at 6am</button>
          </section>

          {run && (
            <section className="panel wide">
              <h2>Run Evidence</h2>
              {run.status === "failed" && (
                <p className="failure-copy">
                  Failed at {run.failedStepIntent || run.failedStepId || "unknown step"}: {run.error}
                </p>
              )}
              <div className="evidence-grid">
                <img src={`/api/runs/${run.id}/evidence`} alt="Run screenshot evidence" />
                <div>
                  <p><strong>Run:</strong> {run.id}</p>
                  <p><strong>Final URL:</strong> {run.evidence?.finalUrl || "unknown"}</p>
                  <p><strong>Started:</strong> {run.startedAt}</p>
                  <p><strong>Ended:</strong> {run.endedAt}</p>
                </div>
              </div>
            </section>
          )}

          {message && <section className="panel wide"><strong>{message}</strong></section>}
        </div>
      </main>
    </div>
  )
}
