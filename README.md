# DoOnce

Record a read-only browser task once. DoOnce compiles the recording into a TracePack, validates it, and prepares it to run on a schedule.

This v0 is intentionally scoped to browser monitoring and extraction:

- Manifest V3 recorder extension
- RawTrace upload endpoint
- Output labeling UI
- TracePack schema and deterministic compiler boundary
- Playwright runner with selector ladders and success predicates
- Email delivery hook

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Extension

Load `extension/` as an unpacked Chrome extension. Use the popup to start and stop recording. Exported traces can be uploaded on the DoOnce home page.

