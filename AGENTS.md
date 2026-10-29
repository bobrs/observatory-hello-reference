# Hello Observatory — agent guidance

Verify this repository's root, remotes, branch, revision and clean/dirty state before work. Scope discovery to this checkout. Read README.md and PROJECT.md and consult the linked active gate before changing scope.

## Accepted baseline and next program

AO-INC-003A Step A / PR #1 merged at `da5731368d49c0426fd57a52588ff3db3e4a69e2`. The Step A authorization and prohibition below describe the historical implementation scope; no later host deployment or packaging expansion is implied. At re-entry verify current `main` and [public program coordination handoff](PROGRAM_HANDOFF.md).

The private Observatory Program coordinates proposed AO-X01, but Hello retains ownership of immutable artifact bytes and its own code. Proposed Wave 1 is **read-only discovery/planning only**: identify a minimal artifact delivery/launch and observation contract, without repackaging, publishing, running new services, changing the Lab/Observatory or inspecting GhostSentry3. New work requires a bounded Sponsor authorization in this repository, and separate PM/Independent Test/merge gates.

Current bounded authorization: **AO-INC-003A / Step A only**, from the Product Sponsor's direct Codex-session instruction, following [Application Observatory Issue #7](https://github.com/bobrs/Application-Observatory/issues/7). Build this independently runnable Node reference app, its three fixed release packages, identity contract, tests and local review evidence. Public repository `bobrs/observatory-hello-reference`, CC0, docs-only main baseline and feature PR are authorized. Record outcomes with source/evidence provenance; role labels do not establish separate authenticated identities.

- Use feature branches and PRs. Do not merge without separate Sponsor authorization and PM review.
- **Do not implement Step B:** no Observatory changes/integration, destination manager, three-stage control surface, CI, registry/release publication, external deployment, privileged operations or unrelated repositories/applications, including GhostSentry3.
- Only this app's own reviewed code may run in local/disposable contexts. Candidates are the fixed three releases, not arbitrary code or downloads.
- Keep baked version, package content identity, source revision and launch context distinct. Runtime self-report is not independent proof of its own code, Test acceptance or health.
- Use reproducible packages and exact tested source/artifact IDs; preserve prior reports and corrections. Keep personal paths, credentials and private data out of public records.
- Keep the implementation tiny and runtime-dependency-free. The project specification records why deployment-specific factory files are omitted.

Later attributable bounded Sponsor instructions supersede historical authorization state; PM/Dev recommendations alone do not authorize new work.
