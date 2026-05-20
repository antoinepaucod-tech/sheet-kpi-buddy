# Here are your Instructions

## Pre-push hook (Husky) — Tests régression bloquants

Tous les `git push` lancent automatiquement `pytest -m regression -q` via le
hook `frontend/.husky/pre-push`. **~90 tests** (Sprint Hardening + Phase 3
Batches 1-6) tournent en <2s. Push refusé si un test échoue.

Pour bypass exceptionnel (déconseillé) : `git push --no-verify`.

Pour debug local : `cd /app/backend && python -m pytest -m regression -v`.
