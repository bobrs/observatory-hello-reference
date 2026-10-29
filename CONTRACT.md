# Artifact identity and runtime contract (schema 1)

This contract is independent of GitHub, Bitbucket or Observatory. There are three fixed reference releases: 1.0.0, 1.1.0 and 1.2.0. Each is a portable Node directory package with no runtime dependencies.

## Exactly which bytes are identified

The five payload files, in ASCII filename order, are:

1. `identity.mjs` — the runtime verifier.
2. `page.html` — the human page template.
3. `release.json` — baked app ID, release version, greeting and accent.
4. `server.mjs` — executable HTTP app.
5. `style.css` — baked release styling.

The build copies source text with CRLF normalized to LF; it writes selected release JSON as UTF-8 `JSON.stringify(release, null, 2)` followed by one LF and substitutes the selected fixed accent into CSS. The artifact digest identifies these **resulting package bytes**, not unnormalized source files.

For each payload file construct an object with properties, in this order: `path` (relative filename), `size` (byte length), `sha256` (lowercase hex SHA-256 of raw bytes). Let `files` be that ordered array. Canonical manifest bytes are UTF-8 of `JSON.stringify({schemaVersion: 1, files})` with no spaces, followed by exactly one LF. `artifactId` is `sha256:` followed by the lowercase hex SHA-256 of those manifest bytes.

The sixth file, `artifact.json`, contains the same manifest plus `artifactId`, in that order, serialized without spaces and followed by LF. It is excluded from its own hash inputs to avoid circular self-hashing. Payload membership is exact; additional, missing, symlinked, hard-linked or oversized files are refused. The builder verifies and reuses an existing content-addressed directory; it does not silently overwrite/repair it.

No timestamp, local path, launch context or Git revision enters the artifact ID. The Node executable/OS are runtime prerequisites, not covered package bytes. Git revision/dirty state are separate build provenance in the external index. The package default is 1.2.0; selecting an earlier descriptor produces that earlier baked release, not a deployment-time override.

## External expected identity versus internal self-check

`artifacts/index.json`, **outside** all packages, maps fixed versions to package digests/directories and records source provenance. The standalone runner imports its verifier from reviewed project source, verifies the candidate against that external expected digest and only then forks the packaged server. The server also verifies its own manifest and caches its startup bytes for consistent serving.

An internal self-check or `/version` report is not independent proof of the code performing the check. A modified package can construct a self-consistent new manifest; the original external digest must still reject it. The index must itself be reviewed/pinned; a locally generated or edited index is not automatically an approved publisher identity. No signatures, attestation service or malicious same-user isolation is claimed.

The review evidence supplies fixed digests from a clean source commit. A later separately authorized launcher must pin an accepted index **outside** the package before execution. It must not substitute a Git SHA, semantic-version string or hash of a changing HTTP response for package identity.

## HTTP contract

- `GET /`: a stylized Hello World page with a large baked version, short/full artifact ID and separate launch context.
- `GET /version`: JSON with `schemaVersion: 1`, `applicationId`, baked `version`, `artifactId`, `context` (object or null), and new per-process `bootId`.
- `GET /style.css`: the verified release's cached styling.
- HEAD equivalents are read-only; other methods are refused. Responses use `Cache-Control: no-store`.

If supplied, `context` contains `destinationId`, `instanceId`, `stage` and `disposableDemo`. Allowed stages are Development, Test and Production; Production requires `disposableDemo: true` and the human page prominently says **DISPOSABLE DEMO — NOT REAL PRODUCTION**. Without context the app explicitly says standalone. Context cannot change immutable version or artifact ID. Environment variables purporting to override version/artifact ID are not read.

The process binds only to `127.0.0.1`; `HELLO_PORT=0` selects an OS-assigned free port. On startup it reports its URL and identity to its owning local runner. The runner passes only this app's defined launch settings, not arbitrary Node options. Startup/HTTP availability does not certify health, Test acceptance, organizational authority or real deployment.

## Step boundary

Step A provides standalone packaging and execution only. The tests sequentially run known artifacts and validate context labels, including an explicitly disposable Production label; they do not create a destination manager. Step B's three-instance control, independently recorded observations, upgrade/rollback workflow and Observatory integration require a separate authorization.
