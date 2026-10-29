# HELLO-1 workspace handoff — developer evidence

Implementation and test source: `fa977f7f9c3d80044dd501ffda111e80bf04b8c5`, clean tracked checkout at test time. Base: `c74c79bb3f59bf6a1324e5b83895c20d86334f14`. This evidence is committed separately; the later evidence-only commit does not change the tested implementation.

Environment: Linux `7.0.0-38-generic x86_64`, Node `v22.22.1`, npm `9.2.0`. **Node 22 is outside the required Node 24.22.1 or newer 24.x patch range.** No supported Node 24 was found in the inspected workspace and standard paths; no installation was performed. The following results are preliminary compatibility evidence only, not a supported-runtime pass. Repeat them on a supported Node 24 before acceptance.

`npm run verify`: syntax checks passed, 11 tests passed with none failed or skipped, and the build completed. `git diff --check` passed. The clean build recorded `sourceDirty: false` and reproduced all three IDs in the existing [Step A evidence index](../step-a/artifact-index.json):

| Version | Artifact ID |
| --- | --- |
| 1.0.0 | `sha256:53cfab8899f14848e3979a1afa2e41c12334fb05bccee5c55398d53598c04262` |
| 1.1.0 | `sha256:17498c7bc08280b1bc2077d9ee302bdada8fb401192f2efce61f594ad2b236e8` |
| 1.2.0 | `sha256:7410f8f433f8d7668000a290b573df8873334ca1f4aadc4622c48b76610b199f` |

The transport tests export each package, copy it again, and verify against an explicit ID from the separately committed evidence index; they check wrong IDs, changed and self-consistently modified files, missing and extra files, symlinks, hard links, an existing destination, and the CLI. Existing tests cover standalone loopback behavior and retained-artifact restart. Tests use short-lived local fixtures/processes and clean them up. The index is developer evidence, not an independently approved publisher identity. No Lab or external target, release publication, independent Test acceptance, supported-runtime execution or hostile same-user isolation is claimed.

Before any target use, Lab still needs a separately authorized retention/transfer path, independently trusted digest distribution and verifier, supported runtime, lifecycle control and independent observation. Promotion and rollback must use retained exact bytes, not a reconstruction performed during promotion.
