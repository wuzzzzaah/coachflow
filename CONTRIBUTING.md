# Contributing to CoachFlow

Thank you for considering a contribution! This is a pnpm workspace with three packages.

## Setup

```bash
# Prerequisites: Node 20+, pnpm 9+
pnpm install
```

## Running locally (no cloud accounts needed)

```bash
docker compose up -d          # Postgres + Redis
cp apps/api/.env.example apps/api/.env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY pointing at the local Postgres
pnpm --filter api dev
```

## Commands

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `pnpm -r typecheck`     | TypeScript typecheck across all packages |
| `pnpm -r lint`          | ESLint across all packages               |
| `pnpm -r test`          | Vitest across all packages               |
| `pnpm --filter api dev` | Start the API in watch mode              |

## Branch conventions

- `main` — always releasable; CI must be green
- `feat/<name>` — new features
- `fix/<name>` — bug fixes
- `chore/<name>` — tooling / docs

## Pull request checklist

- [ ] `pnpm -r typecheck` passes
- [ ] `pnpm -r lint` passes
- [ ] `pnpm -r test` passes
- [ ] New behaviour covered by tests
- [ ] No secrets or credentials committed
- [ ] `AGENTS.md` updated if the adapter pattern changes

## Adapter pattern

New WhatsApp adapters, AI adapters, and session stores must pass the shared contract tests in `packages/shared/src/contracts/`. See `docs/architecture.md` for the full guide.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
