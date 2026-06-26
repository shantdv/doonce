let recording = false
let trace = null
let lastUrl = location.href

function traceId() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `trace_${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`
}

function now() {
  return Date.now()
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&")
}

function selectorFor(element) {
  if (!(element instanceof Element)) return "body"

  const aria = element.getAttribute("aria-label")
  if (aria) return `${element.tagName.toLowerCase()}[aria-label="${aria.replaceAll('"', '\\"')}"]`

  const testId = element.getAttribute("data-testid")
  if (testId) return `[data-testid="${testId.replaceAll('"', '\\"')}"]`

  if (element.id) return `#${cssEscape(element.id)}`

  const parts = []
  let current = element
  while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
    const tag = current.tagName.toLowerCase()
    const className = Array.from(current.classList).slice(0, 2).map((name) => `.${cssEscape(name)}`).join("")
    parts.unshift(`${tag}${className}`)
    current = current.parentElement
  }

  return parts.join(" > ") || "body"
}

function pushEvent(event) {
  if (!recording || !trace) return
  trace.events.push(event)
}

function visibleElementSnapshot() {
  const candidates = Array.from(document.querySelectorAll("h1,h2,h3,a,button,label,input,select,textarea,td,th,li,p,span,strong,[role='button'],[data-testid]"))
  const elements = []

  for (const element of candidates) {
    const rect = element.getBoundingClientRect()
    const text = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? element.value || element.placeholder || element.getAttribute("aria-label") || ""
      : element.textContent?.trim() || element.getAttribute("aria-label") || ""

    if (!text || rect.width < 2 || rect.height < 2) continue
    if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) continue

    elements.push({
      selectorHint: selectorFor(element),
      text: text.slice(0, 180),
      rect: {
        x: Math.max(0, rect.x),
        y: Math.max(0, rect.y),
        width: rect.width,
        height: rect.height
      }
    })

    if (elements.length >= 200) break
  }

  return elements
}

async function captureEvidence() {
  if (!recording || !trace) return

  const capturedAt = now()
  trace.domSnapshots.push({
    id: `dom_${capturedAt}`,
    capturedAt,
    html: document.documentElement.outerHTML
  })
  trace.elementSnapshots.push({
    id: `elements_${capturedAt}`,
    capturedAt,
    elements: visibleElementSnapshot()
  })

  try {
    const response = await chrome.runtime.sendMessage({ type: "DOONCE_CAPTURE_SCREENSHOT" })
    if (response?.dataUrl) {
      trace.screenshots.push({
        id: `screenshot_${capturedAt}`,
        capturedAt,
        dataUrl: response.dataUrl
      })
    }
  } catch {
    // Screenshots require extension privileges and can fail on browser-owned pages.
  }
}

function startRecording() {
  trace = {
    id: traceId(),
    userId: "local_user",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    browser: {
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    },
    events: [],
    screenshots: [],
    domSnapshots: [],
    accessibilitySnapshots: [],
    elementSnapshots: [],
    networkEvents: []
  }

  recording = true
  lastUrl = location.href
  pushEvent({ type: "navigate", url: location.href, timestamp: now() })
  captureEvidence()
}

function stopRecording() {
  if (trace) trace.endedAt = new Date().toISOString()
  recording = false
}

document.addEventListener("click", (event) => {
  const target = event.target
  if (!(target instanceof Element)) return

  pushEvent({
    type: "click",
    selectorHint: selectorFor(target),
    text: target.textContent?.trim().slice(0, 120),
    x: event.clientX,
    y: event.clientY,
    timestamp: now()
  })
  captureEvidence()
}, true)

document.addEventListener("input", (event) => {
  const target = event.target
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return
  const valueKind = target.type === "password" ? "secret" : "literal"

  pushEvent({
    type: "input",
    selectorHint: selectorFor(target),
    valueKind,
    value: valueKind === "secret" ? undefined : target.value,
    timestamp: now()
  })
}, true)

document.addEventListener("submit", (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  pushEvent({ type: "submit", selectorHint: selectorFor(target), timestamp: now() })
}, true)

window.addEventListener("scroll", () => {
  pushEvent({ type: "scroll", x: window.scrollX, y: window.scrollY, timestamp: now() })
}, { passive: true })

setInterval(() => {
  if (!recording || location.href === lastUrl) return
  lastUrl = location.href
  pushEvent({ type: "navigate", url: location.href, timestamp: now() })
  captureEvidence()
}, 500)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DOONCE_PING") {
    sendResponse({ ok: true })
  }

  if (message.type === "DOONCE_START") {
    startRecording()
    sendResponse({ ok: true })
  }

  if (message.type === "DOONCE_STOP") {
    stopRecording()
    sendResponse({ ok: true })
  }

  if (message.type === "DOONCE_EXPORT") {
    if (trace) trace.endedAt = new Date().toISOString()
    sendResponse(trace)
  }

  if (message.type === "DOONCE_STOP_AND_EXPORT") {
    stopRecording()
    sendResponse(trace)
  }

  return true
})
