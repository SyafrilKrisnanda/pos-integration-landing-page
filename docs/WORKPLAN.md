# WORKPLAN.md — P001 Bakso Pak Budi

Timezone kerja: Asia/Jakarta (UTC+7)
Jam kerja otomatis Karen: 08:00–12:00 WIB
Sore: rangkuman harian sekitar 15:00 WIB agar user punya waktu review

## Current status

- Project: P001 — Website Bakso Pak Budi
- Type: UMKM/company profile landing page
- Stage: local static implementation created
- Coding: approved for local static site; initial files created in `site/`
- Deploy: not allowed
- Public ports: not allowed
- Active project registry: `/home/synner/.openclaw/workspace/projects/ACTIVE_PROJECTS.md`

## Approval gates

Karen must stop and tag the user for approval before:

- creating or modifying large project code
- installing dependencies
- running deploy/staging/production steps
- opening public ports
- restarting services for a client app
- handling secrets/tokens/credentials
- changing hosting/domain/DNS

Discord approval mention target: `<@374712889509937152>`

## 7-day work rhythm

### Day 1 — Scope and docs

- Confirm PROJECT.md, REQUIREMENTS.md, DECISIONS.md, COSTING.md, QA.md, DEPLOYMENT.md, TASKS.md.
- Ensure phase-1 scope is clear.
- Keep status as documentation-only unless user approves coding.

### Day 2 — Content and UI planning

- Refine copy/content structure.
- Refine Squidward UI section plan.
- Prepare content checklist for real client assets.

### Day 3 — Implementation readiness

- User approved local coding on 2026-05-13.
- Minimal static site created in `site/`.

### Day 4 — Build/content pass

- Coding is approved for local work only.
- Work in small chunks.
- Avoid deploy/public ports.

### Day 5 — QA pass

- Use QA.md checklist.
- Fix only approved/local issues.

### Day 6 — Staging planning

- Only if staging/deploy is approved.
- Prefer provider-managed static hosting; do not use Karen's Azure VM as default production hosting.

### Day 7 — Handover

- Update FINAL_SUMMARY.md.
- List delivered work, blockers, next approvals, and handover notes.

## Daily cron behavior

Core rule: follow the PM timeline and TASKS.md. Do not invent extra work just because the schedule runs. If today's planned work is already complete, report that it is complete, mention the next scheduled phase, and wait for user instructions.

### 08:00 WIB — Morning PM check-in

- Read ACTIVE_PROJECTS.md and this WORKPLAN.md.
- Read only the minimum relevant project docs.
- Identify today's scheduled PM phase and small next step from TASKS.md/WORKPLAN.md.
- If today's step is already complete, say so and wait; do not create bonus tasks.
- If the next step requires approval, tag the user and stop.
- Otherwise update TASKS.md/notes only if it is part of today's planned phase; keep work lightweight.

### 12:00 WIB — Midday checkpoint

- Summarize what changed this morning.
- List blockers/approval needed.
- If morning work is already complete, report complete and wait.
- Do not start new large work or jump ahead to the next day.

### 15:00 WIB — Afternoon summary

- Summarize what Karen did today.
- Mention files changed, decisions, blockers, and next recommended scheduled phase.
- If today's work is done, say that Karen is waiting for user review or new instructions.
- Tag user only if approval is needed.

## Token-saving rules

- Do not read entire Discord history.
- Prefer project markdown files as source of truth.
- Read only ACTIVE_PROJECTS.md, WORKPLAN.md, TASKS.md, and one or two relevant docs.
- Keep Discord updates short.
- Do not run broad scans unless debugging.
