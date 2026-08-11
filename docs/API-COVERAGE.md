# API Coverage

`@putdotio/sdk` is the canonical full put.io API client. Endpoint completeness means every
supported, user-facing public API capability is represented by a typed SDK operation, an explicit
canonical equivalent, or a direct-route URL helper.

## Current Audit Outcome

The maintained public backend surface and first-party consumers were compared with the canonical
SDK operation tree for issue [#172](https://github.com/putdotio/putio-sdk-typescript/issues/172).
The comparison found one unresolved supported capability: the XSPF playlist route used for VLC
handoff. `files.getXspfPlaylistUrl(...)` closes that gap. No supported public endpoint gaps remain
from that audit.

The audit enumerated current public route registrations, compared method and path contracts with
SDK requests and direct-route helpers, inspected backend authentication and response behavior for
every mismatch, and checked current first-party web and CLI usage before deciding whether a route
was supported, equivalent, legacy, or private. Earlier request, response, and typed-error contract
alignment is recorded in [#108](https://github.com/putdotio/putio-sdk-typescript/issues/108).

This is a point-in-time completeness result, not a claim that future backend changes are detected
automatically. Response-branch and mutation-depth confidence remains a separate live-testing
concern.

## Scope

The completeness contract includes authenticated JSON operations, public registration and OAuth
operations intended for API consumers, and direct content routes that consumers access through
SDK-generated URLs.

It excludes:

- admin, private, restricted, secret-key, and service-to-service routes
- browser page, callback, and form-post routes that are not API-client operations
- legacy aliases when the SDK exposes the canonical replacement
- transport aliases when one safer method reaches the same handler and contract

## Evidence Boundary

The backend-wide inventory, extractor, and private route classifications stay in the private
owning environment. [`api-route-matrix.json`](api-route-matrix.json) contains portable public
evidence for selected contract decisions and validates each named operation on both the Effect and
Promise clients. It is deliberately not the complete backend route inventory.

## Refresh Contract

Repeat the private comparison when a public backend route changes, a first-party consumer needs an
unmodeled capability, or a contract-drift report is confirmed. For every supported gap:

1. update the request, response, and typed error boundary together
2. keep the Effect and Promise client surfaces aligned through the canonical operation tree
3. add deterministic request and parsing coverage
4. add safe live proof when local fixtures cannot establish the behavior
5. add only public-safe evidence to this repository
