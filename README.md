# Hello Observatory

A tiny independently runnable Node.js reference app with an unmistakable version banner and content-addressed packages. Public and CC0. **AO-INC-003A / Step A only**: no Observatory integration or destination/deployment manager.

## Run locally

Use Node **24.22.1 or a supported newer 24.x patch** and npm; `.node-version` pins the tested runtime.

```sh
npm ci
npm run verify
npm start
```

Open the printed `http://127.0.0.1:...` URL. The default package is **1.2.0**. **Read version JSON** opens `/version`; the page's details show the full artifact identity and runtime boot. Ctrl-C stops the one app process. There are no runtime dependencies; Playwright is a development-only screenshot tool.

To review a different retained package, stop the previous process and choose one of the fixed releases:

```sh
npm run review -- 1.0.0
npm run review -- 1.1.0
npm run review -- 1.2.0
```

This runs actual packaged app bytes after checking them against the index outside the package. It does not edit a status/version field. There is no automatic upgrade, rollback or target control. Step B will need separate authorization.

## Packaging and identity

`npm run build` deterministically creates three packages in ignored `artifacts/<digest>/` and the external `artifacts/index.json`. Each package contains server, verifier, page, CSS, baked release metadata and a digest sidecar. It runs without npm packages or Observatory. Do not edit an artifact in place; a damaged existing content-addressed directory is refused rather than repaired silently.

[CONTRACT.md](CONTRACT.md) precisely defines covered bytes, canonical serialization, SHA-256, endpoint fields, self-check limitations and future index trust. Rebuilding the same inputs yields the same artifact IDs. The index's Git revision/dirty flag is provenance, not part of package identity; build timestamps and launch context are excluded. The app keeps verified startup bytes in memory, so later filesystem edits cannot silently change what that process serves.

The index is only as trusted as its reviewed/pinned source. For this unmerged local review it is locally built evidence, not independent acceptance. A later launcher must compare bytes against an approved digest **outside** the candidate package before executing it. Internal self-verification and `/version` alone do not attest their own code.

## Optional standalone context smoke check

The default app has no destination/stage and says so. Optional context is launch metadata, not version or authority:

```sh
HELLO_STAGE=Test HELLO_DESTINATION_ID=standalone-smoke HELLO_INSTANCE_ID=local-check npm run review -- 1.1.0
```

Development/Test/Production labels are supported only as context. Production requires `HELLO_DISPOSABLE_DEMO=true` and prominently displays **DISPOSABLE DEMO — NOT REAL PRODUCTION**. No real Production capability is provided. This is a single app label check, not Step B's three-destination workflow. `HELLO_PORT` may select a local port; by default a free loopback port is chosen. The process does not read version overrides from environment variables or accept executable uploads, commands or endpoints.

## Verify and capture

`npm run verify` checks JavaScript syntax, runs native Node tests and builds the three fixed releases. No TypeScript compilation, runtime package installation, CI or external service is involved. Tests use disposable package directories, verify reproducibility/tampering/external digest checks, and run the app independently over actual loopback HTTP. Context/boot changes preserve version identity. Sequentially restarting an original retained artifact checks portability; it does not build a deployment manager.

Optional screenshots (macOS/Linux shell):

```sh
PLAYWRIGHT_BROWSERS_PATH=.cache/playwright npx playwright install chromium
npm run demo
```

The demo uses project-local Chromium and disposable packages, runs one version at a time, checks desktop/mobile rendering and `/version`, and saves screenshots plus a source-stamped report to ignored `test-results/demo/`. It stops its app/browser processes and removes temporary packages. Full evidence and exact tested revision are recorded in the feature PR. Developer evidence is not independent Test acceptance.

## Scope and provenance

The Product Sponsor authorized this exact public CC0 repository and Step A in the Codex session following [Application Observatory Issue #7](https://github.com/bobrs/Application-Observatory/issues/7) and its [PM review](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6485169603). [PROJECT.md](PROJECT.md) records this as an attributed Dev transcription, not separate authenticated GitHub role identity.

Only the documentation/license baseline is accepted on `main`. This feature is for PM/Sponsor review; merge needs a separate Sponsor authorization. No registry/release publication, CI, deployment tooling, external hosting, privileged operations, unrelated applications, GhostSentry3 or Step B work is included. The Node runtime/OS and a malicious same-user process are outside the package-integrity boundary; this is not supply-chain attestation or a health guarantee.
