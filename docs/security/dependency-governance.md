# Dependency Governance

## Scope

This document defines the operating policy for third-party dependency updates in CashPilot.

## Objectives

- Keep the application aligned with security patches and ecosystem updates.
- Avoid breaking changes in production by default.
- Ensure dependency changes are traceable, reviewable, and test-backed.

## Update Sources

- `npm` packages managed through Dependabot.
- `github-actions` workflow dependencies managed through Dependabot.
- Security alerts raised by GitHub Dependabot alerts or npm advisories.

## Default Policy

- Patch and minor updates are eligible for automatic pull requests.
- Major updates require manual review and explicit approval.
- Security fixes are prioritized over feature upgrades.
- Dependency updates must not weaken existing release gates.

## Review Flow

1. Dependabot opens a pull request.
2. CI runs the standard quality gates.
3. A reviewer checks functional impact, security impact, and bundle/runtime risk.
4. The PR is merged only if tests, lint, and build pass.

## Security Alert Response

- Severity `critical`: investigate immediately, patch or mitigate the same day when possible.
- Severity `high`: schedule within the current release window.
- Severity `medium` or `low`: batch with the normal update cadence unless a fix is trivial.

## Escalation Rules

- If an update changes public APIs, runtime behavior, or release tooling, treat it as a controlled change.
- If a security alert affects auth, payments, accounting, or demo access, escalate to engineering and compliance review.
- If a dependency is abandoned or unmaintained, plan replacement work rather than indefinite pinning.

## Exclusions

- No workflow file changes are performed by this policy outside Dependabot PRs.
- No package version is bumped manually without a review trail unless responding to an active security incident.

## Operational Notes

- Keep Dependabot PRs small and merge them frequently.
- Prefer patch/minor consolidation to reduce update noise.
- Validate with the existing CI gates before promoting to production.
