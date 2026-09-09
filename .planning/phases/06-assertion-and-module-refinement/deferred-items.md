# Phase 06 Deferred Items

## 1. Stale notification hub reference outside Plan 06-19 callers

- **Found during:** Plan 06-19 sole-dispatch census
- **File:** `extensions/pi-claude-marketplace/shared/README.md:7`
- **Issue:** The README still names `shared/notify.ts` as the sole direct notification owner, although production TypeScript correctly routes all eight direct calls through `shared/notification-dispatch.ts`.
- **Disposition:** Deferred to the planned final notification-hub cleanup. Plan 06-19 owns only its seven listed callers and does not broaden an import-only migration into unrelated documentation.
