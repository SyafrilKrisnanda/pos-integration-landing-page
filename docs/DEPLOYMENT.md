# DEPLOYMENT.md

## Deployment policy

Production deployment requires human approval.
Client production apps should not default to Karen's Azure VM.

For P001 current step:

- **Do not deploy to production.**
- **Do not open public ports.**
- **Do not start public services.**
- **Do not create production hosting.**
- Local static files may be edited because coding lokal was approved.
- Local-only preview is allowed on `127.0.0.1`.

## Target hosting

- Provider: not selected
- Environment: staging later only if separately approved
- Domain: none yet
- Runtime: static site if build later approved
- Database: none

## Docker decision

- Docker required? no
- Reason: P001 phase 1 is a simple static UMKM/company-profile website. Docker would add unnecessary complexity unless future scope introduces backend services.

Use Docker when it improves repeatability, rollback, or backend service management. Do not force Docker for simple static/company-profile sites.

## Environment variables

Do not write secret values here. List names only.

- None required for phase 1 documentation.
- If future analytics/maps API is added, list variable names here without secret values.

## Local preview

- Current local preview: `http://127.0.0.1:8787/`
- Bind address: `127.0.0.1` only
- Started from: `/home/synner/.openclaw/workspace/projects/P001-bakso-pak-budi/site`
- Process/session: `wild-slug`
- Public exposure: none

## Deploy steps

Production/staging deployment is **not approved** in the current phase.

If later approved for staging, recommended safe path:

1. Confirm staging provider: Cloudflare Pages, Netlify, or Vercel.
2. Confirm repo/source location.
3. Confirm no secrets are required.
4. Build static site locally or via provider.
5. Deploy to provider-managed staging URL.
6. Verify HTTPS and page access.
7. Run Gary QA checklist.

## Rollback steps

If future staging deploy is approved:

1. Use hosting provider rollback to previous successful static deployment.
2. Confirm page loads.
3. Re-run WhatsApp and Maps link checks.
4. Notify Karen for status update.

## Backup plan

- Current documentation lives in `/home/synner/.openclaw/workspace/projects/P001-bakso-pak-budi/`.
- If code is later created, store it in a Git repository before deployment.
- Keep source private unless user approves otherwise.

## Post-deploy checklist

Not applicable yet because deploy is not approved.

- [ ] App responds
- [ ] Domain works, if applicable
- [ ] HTTPS works
- [ ] WhatsApp CTA works
- [ ] Google Maps link/embed works
- [ ] Logs checked, if provider supports it
- [ ] No secrets exposed
- [ ] No public VM port opened
