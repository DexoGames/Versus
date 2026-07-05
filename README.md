# Versus — vs.dexo.games

Three head-to-head games from the Gridlock+ collection (Unity/iOS), rebuilt
for the browser as a standalone sibling of [www.dexo.games](https://www.dexo.games).
Same stack, same design tokens, same square-cornered identity.

## Games

| Game | Players | Modes |
| --- | --- | --- |
| **Gridlock** | 2–4 | vs CPU · hotseat · online |
| **Spellout** | 2 | vs CPU · hotseat · online |
| **Undercut** | 3 | vs CPU · hotseat · online (commit-reveal bids) |

Every game is a pure, deterministic TypeScript engine (`src/games/*`) with the
React UI, CPU opponents and online sync all driving the same
`applyMove`/`getLegalMoves` functions.

- **Gridlock** — chain-drawing territory game. Enclosure scoring uses a grid
  flood-fill from the outside (simpler + exact vs the Unity polygon sampler);
  the CPU is alpha-beta over a shared mutable sim with apply/undo, depths
  4/6/10/14 by difficulty and root-move jitter that shrinks as difficulty
  rises. Players move twice per turn (once on the very first turn), exactly
  like the Unity build.
- **Spellout** — the Gridlock+ flavour of Ghost: dead letters lose instantly,
  completing an unextendable word *wins*. Dictionary is a sorted word array
  with binary-search prefix ranges (128k words); Extreme runs a memoized
  minimax over the prefix tree.
- **Undercut** — simultaneous secret bids, lowest wins unless undercut by
  exactly one higher (undercuts chain upward through runs — `1,2,3` → the 3
  wins). `resolveRound` is a faithful port of the Unity `CalculateWinner`.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # engine unit tests (vitest)
npm run build    # tsc + vite build → dist/
```

## Online play (optional)

CPU and hotseat modes work fully offline. Online rooms need a Firebase
project (Firestore + Anonymous Auth):

1. Copy `.env.example` to `.env` and fill in the web-app config.
2. Deploy `firestore.rules` (`firebase deploy --only firestore:rules`).
3. For GitHub Pages, add the same four values as repo Actions secrets.

Rooms live at `rooms/{CODE}`; joiners follow `…/gridlock?room=CODE` links.
Moves are re-validated by every peer's engine before being trusted, and
Undercut bids use SHA-256 commit-reveal so nobody can peek pre-reveal. The
Firebase SDK is dynamically imported — offline visitors never download it.

## Deploy

GitHub Pages via `.github/workflows/deploy.yml` (build + test + publish
`dist/`). `public/CNAME` pins `vs.dexo.games`; add a DNS CNAME record next to
the existing `www` one. The build injects a strict CSP (extended with the
Firebase hosts) and copies `index.html` → `404.html` so deep links resolve.
