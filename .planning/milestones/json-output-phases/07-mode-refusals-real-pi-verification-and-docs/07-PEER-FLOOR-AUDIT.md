# Exact Pi Peer-Floor Package Audit

Verified on 2026-10-10 UTC for the isolated real-runtime fixture.

## Authorization

D-11 and the current execution instruction explicitly authorize the separate
`@earendil-works/pi-coding-agent@0.86.1` fixture. The user approved D-01 through
D-14 and clarified that the age-only SUS finding on this existing trusted peer
does not create a new permission gate. D-14 concerns the corpus only.

The fixture must not downgrade the root development installation or change the
product's `>=0.86.1` peer range. Lock generation and installation both use
`--ignore-scripts`. A different identity, integrity mismatch, unexpected
postinstall, or concrete new security risk falls outside this authorization.

## Registry Verification

Command, exit 0:

```sh
npm view @earendil-works/pi-coding-agent@0.86.1 name version repository dist.integrity scripts.postinstall --json --fetch-retries=0 --fetch-timeout=15000
```

| Field | Observed value |
| --- | --- |
| Name | `@earendil-works/pi-coding-agent` |
| Version | `0.86.1` |
| Repository | `git+https://github.com/earendil-works/pi.git` |
| Repository directory | `packages/coding-agent` |
| Postinstall | Absent |
| Integrity | `sha512-vZBuNfJnruxZyemZ3O05V0S/Ylze08ahFTIQ1Mik++gVdOevPl89gt/Uv0U97BPAJaj9cj6Vf9rcIgKtUrd0BA==` |

Identity and integrity match `07-RESEARCH.md` exactly. The registry tarball is
`https://registry.npmjs.org/@earendil-works/pi-coding-agent/-/pi-coding-agent-0.86.1.tgz`.

## Preserved Planning Audit Facts

The planning audit recorded 4,366,827 weekly downloads, package creation on
2026-05-07, and version publication on 2026-09-20. Its automated verdict was
**SUS**, with **too-new** as the only remaining reason. Existence, repository,
downloads, and absence of postinstall passed; no package was classified SLOP.
The planning audit independently matched the downloaded tarball's SHA-512.

These historical measurements are not new measurements of download count or
package age. The execution registry check above confirms the authorized
artifact's identity before provisioning. Runtime acceptance is recorded
separately in `07-03-SUMMARY.md` after both targets execute.

## Transitive Dependency Advisory Disposition

Lock generation exited 0 and reported one high-severity dependency.
`npm --prefix tests/e2e/pi-peer-floor audit --json` exited 1. It reports
`brace-expansion@5.0.9`, reached through `minimatch@10.2.6`, with these advisories:

- [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7):
  high, nested-brace recursion exhausts the stack.
- [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p):
  high, comma-part recursion exhausts the stack.
- [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr):
  moderate, quadratic expansion consumes CPU.

The root lock already contains the same `brace-expansion@5.0.9` artifact and
integrity, including under the installed Pi package. This is a pre-existing
dependency issue, not an age signal or an artifact-identity mismatch.

Fixture scope assessment: the advisories require attacker-controlled brace
patterns. These cases use fixed slash commands, a checked-in extension fixture,
fresh empty project/home/session directories, no marketplace inputs, no inherited
credentials, offline mode, and no model prompts. They do not accept untrusted glob
patterns. Each child has a 20-second kill deadline and bounded captured output.
The published impact is availability loss, not code execution or disclosure.
There is no new reachable high-severity surface in this constrained fixture, so
the existing authorization remains applicable. This is not a clean npm audit or
a general safety claim about running Pi against untrusted projects.

Preserve the exact upstream fixture tree for the floor test. General dependency
remediation in the root installation is outside this plan; no audit fix or root
lock change is made here.
