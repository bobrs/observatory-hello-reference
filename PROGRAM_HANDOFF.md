# Observatory Program — public coordination handoff (proposed)

Hello Observatory is a **public CC0 independent reference workload**. Its accepted Step A artifact/HTTP contract is in [CONTRACT.md](CONTRACT.md). Accepted `main` contains PR #1 at `da5731368d49c0426fd57a52588ff3db3e4a69e2`; verify live GitHub state at re-entry.

The private `bobrs/Observatory-Program` coordinates proposed AO-X01, but cannot silently authorize source changes or integrations here. The separate Lab repository owns automation and target environment operations. Hello does not become an infrastructure controller.

**Proposed Wave 1: read-only design discovery.** Examine the current three fixed versioned packages, external expected digest/index, runtime boot and `/version` semantics; propose the narrowest delivery/verification/launch interface necessary for manual activation, rollback and separately sourced observation on a disposable Lab target. Preserve exact package identity; do not silently rebuild an older version during deployment. Self-report is not hostile-host attestation or independent health.

This file does not authorize registry publication, packaging or code modifications, Lab access, new host services, privileged changes or cross-repository edits. Use a scoped Issue/PR for proposals, and require later explicit Sponsor implementation and merge authorization. Independent Test acceptance is distinct from developer checks. GhostSentry3 remains excluded and protected.
