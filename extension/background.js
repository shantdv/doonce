chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DOONCE_CAPTURE_SCREENSHOT") {
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
      sendResponse({ dataUrl })
    })

    return true
  }

  if (message.type === "DOONCE_UPLOAD_TRACE") {
    fetch("http://127.0.0.1:3000/api/traces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.trace)
    })
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error || "Upload failed")
        chrome.tabs.create({ url: `http://127.0.0.1:3000/?traceId=${encodeURIComponent(body.traceId)}` })
        sendResponse({ ok: true, traceId: body.traceId })
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }))

    return true
  }

  return false
})
