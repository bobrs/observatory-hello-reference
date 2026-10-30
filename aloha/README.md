# Aloha reference workload

Aloha is a tiny, independently runnable sunny greeting app in its own area. It uses Node's standard library and binds only to `127.0.0.1`. The fixed identity is `observatory-aloha-reference` at baked version `1.0.0`.

## Build and run

Use Node `24.22.1` from the repository's pinned runtime. From the repository root:

```sh
node aloha/build.mjs
node aloha/artifacts/a5565ea89496151b96d7181e3ed3c796bdedd2df6788fd639632d54913200908/server.mjs
```

The build writes `aloha/artifacts/<digest>/` and a local `aloha/artifacts/index.json`. The package has exactly five payload files (`identity.mjs`, `page.html`, `release.json`, `server.mjs`, `style.css`) and `artifact.json`. The SHA-256 artifact ID covers the canonical sidecar manifest and payload bytes; no timestamp, launch context, or source revision enters the ID. Existing content-addressed output is checked and never repaired in place.

To export the package to a new directory, build first and supply the digest pinned in [evidence/artifact-index.json](evidence/artifact-index.json):

```sh
node aloha/export.mjs sha256:a5565ea89496151b96d7181e3ed3c796bdedd2df6788fd639632d54913200908 /tmp/aloha-export
```

The export command checks the expected digest against the committed evidence index, verifies the source package, copies all six files, and verifies the result. `identity.mjs` exports `verifyPackage(directory, expectedArtifactId)` for callers using reviewed source. The expected digest must be obtained from a trusted source outside the candidate package. This committed pin is developer evidence, not independent release approval.

The app serves `GET` and `HEAD` on `/`, `/style.css`, and `/version`; other methods receive `405`, and unknown paths receive `404`. The JSON identity includes the baked application ID/version, immutable artifact ID, per-process boot ID, and either null context or the supplied context. Context accepts only `Development`, `Test`, `QA`, or `Demo`, with destination and instance IDs. There is no real Production stage.

For a context-labeled local run:

```sh
ALOHA_STAGE=Test ALOHA_DESTINATION_ID=aloha-local ALOHA_INSTANCE_ID=check-1 node aloha/artifacts/a5565ea89496151b96d7181e3ed3c796bdedd2df6788fd639632d54913200908/server.mjs
```

The process selects a free port by default and prints its loopback URL and self-reported identity. Set `ALOHA_PORT` to choose another local port. Runtime self-report, including its own artifact ID and boot ID, is not independent proof of the code, health, acceptance, or authority. The external verifier/pin is the content check; it does not isolate against a malicious process with the same user permissions.

## Checks

```sh
node --test aloha/test/*.test.mjs
npm run verify
```

The Aloha tests exercise reproducible builds, fixed external pin matching, exact package membership, tamper rejection, loopback GET/HEAD routes, non-GET refusal, version identity, boot ID, and explicit QA context. The repository's `npm run verify` checks Hello's unchanged implementation and retained packages.
