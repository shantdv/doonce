const statusEl = document.getElementById("status")

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function sendToTab(message) {
  const tab = await activeTab()
  if (!tab?.id) throw new Error("No active tab")
  return chrome.tabs.sendMessage(tab.id, message)
}

document.getElementById("start").addEventListener("click", async () => {
  try {
    await sendToTab({ type: "DOONCE_START" })
    statusEl.textContent = "Recording"
  } catch (error) {
    statusEl.textContent = error.message
  }
})

document.getElementById("stop").addEventListener("click", async () => {
  try {
    await sendToTab({ type: "DOONCE_STOP" })
    statusEl.textContent = "Stopped"
  } catch (error) {
    statusEl.textContent = error.message
  }
})

document.getElementById("send").addEventListener("click", async () => {
  try {
    const trace = await sendToTab({ type: "DOONCE_STOP_AND_EXPORT" })
    const response = await chrome.runtime.sendMessage({ type: "DOONCE_UPLOAD_TRACE", trace })
    if (!response?.ok) throw new Error(response?.error || "Upload failed")
    statusEl.textContent = "Trace sent to DoOnce"
  } catch (error) {
    statusEl.textContent = error.message
  }
})

document.getElementById("export").addEventListener("click", async () => {
  try {
    const trace = await sendToTab({ type: "DOONCE_EXPORT" })
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${trace.id}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    statusEl.textContent = "Trace exported"
  } catch (error) {
    statusEl.textContent = error.message
  }
})
