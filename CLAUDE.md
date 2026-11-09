# Plateforme de cours particuliers en ligne (client : Manon Ambrosia)

Cahier des charges : `docs/cahier-des-charges.md`. Stack : Next.js (App Router), TypeScript strict, Prisma, PostgreSQL.
Langue : interface et textes en français ; code, noms de variables et commits en anglais.

## Équipe d'agents (lancer avec `claude --agent orchestrateur`)
| Agent | Modèle | Zone d'écriture |
|---|---|---|
| orchestrateur | sonnet | `docs/STATUS.md` |
| architecte | opus | `docs/**`, `prisma/schema.prisma` |
| designer | sonnet | `design/**`, `docs/design/**` |
| planificateur-tests | sonnet | `docs/tests/**` |
| testeur | sonnet | `tests/**`, `e2e/**`, configs de test |
| backend | sonnet (opus sur modules critiques) | `src/app/api/**`, `src/server/**`, `src/lib/**`, `src/emails/**`, `prisma/migrations/**` |
| frontend | sonnet | `src/app/**` hors `api`, `src/components/**`, `src/hooks/**`, `src/styles/**`, `public/**` |
| securite | opus | `docs/security/**` (lecture seule sur le code) |
| reviewer | opus | `docs/reviews/**` (lecture seule sur le code) |
| merger | haiku | aucune (git et PR uniquement) |

Les limites sont appliquées par `.claude/hooks/policies.json` + `.claude/hooks/guard.mjs` (source de vérité) et `.claude/settings.json` (refus globaux). Vérification : `node .claude/hooks/selftest.mjs`.

## Workflow par tranche
Architecte (G1) → Designer ∥ Planificateur-tests (G2, G3) → Testeur (phase rouge) → commit de checkpoint → Backend ∥ Frontend (worktrees) → Reviewer ∥ Sécurité (≤ 3 boucles) → Merger → PR (G4).
G1 à G4 = validations humaines. Aucun agent ne fusionne dans `main`.

## Règles absolues
1. Aucun code applicatif sans tests validés avant (phase rouge constatée).
2. Les agents qui écrivent le code ne modifient JAMAIS les tests. Test jugé faux → remonter à l'orchestrateur.
3. Chaque agent reste dans sa zone. Besoin hors zone → demande à l'orchestrateur, pas de contournement (y compris via le shell).
4. Les décisions métier ouvertes (paiement, mentions légales, délais d'annulation, durées de conservation) vont dans `docs/questions-client.md` ; personne ne les invente.
5. Pas de secrets dans le code ni dans les logs ; jamais de donnée d'enfant dans les logs.
6. Heures stockées en UTC ; affichées dans le fuseau de l'utilisateur (Madagascar ↔ France).

## Tranches (ordre prévu)
1. Comptes et rôles (parent / élève / adulte / admin) — 2. Agenda, réservation, fuseaux, rappels — 3. Offres et crédits, paiement (virement manuel d'abord) — 4. Cours en direct (visio intégrée via service existant) — 5. Factures — 6. Ressources PDF — 7. Back-office — 8. Durcissement RGPD et sécurité transverse.

## Phase 0 (humaine, avant les agents)
1. Dépôt git avec branche `main`, remote GitHub, `gh auth login` fait, protection de `main` activée (PR obligatoire).
2. Scaffolding : Next.js (App Router, TypeScript, Tailwind), Prisma + PostgreSQL, Vitest, Playwright. Scripts `package.json` obligatoires : `test`, `lint`, `typecheck` (`tsc --noEmit`), `build`, `dev`.
3. `.gitignore` contenant `.env*` (sauf `.env.example`) et `.claude/worktrees/`.
4. Deux bases PostgreSQL distinctes : développement et tests (`DATABASE_URL` dans `.env`, `.env.test` pour les tests). `.worktreeinclude` copie ces fichiers dans chaque worktree.
5. `npm run test`, `npm run lint`, `npm run typecheck` et `npm run build` passent sur le projet vide ; premier commit sur `main` avec `.claude/`, `CLAUDE.md` et `docs/`.
6. `node .claude/hooks/selftest.mjs` : tous les cas conformes.
Les fichiers de configuration racine (`package.json`, `tsconfig`, `next.config`) ne sont modifiables par aucun agent hors `npm install`.

## Structure attendue
`src/app` (pages) · `src/app/api` · `src/server` · `src/lib` (dont `time`) · `src/components` · `src/hooks` · `src/styles` · `src/emails` · `prisma/` · `tests/` · `e2e/` · `design/` · `docs/`
