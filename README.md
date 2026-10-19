# ANON Arcade

Free ANON-themed games for AnonNfts.com. Hosted on GitHub Pages (repo `anonnftgroup-cpu/Anon-games`)
and shown on https://anonnfts.com/anon-games through one GoDaddy HTML section (an iframe of the repo root).
The GoDaddy page never needs changing again: new games appear in the Arcade automatically.

## What's in the repo

```
index.html            the Arcade hub (games grid, search, categories, leaderboards tab)
games.json            the list of games. One entry per game. This is the only "menu" to edit.
shared/leaderboard.js shared global leaderboard + nickname prompt, used by every game and the hub
assets/               logo, apple-touch icon, generic "coming soon" thumbnail
solitaire/            ANON Solitaire (index.html, thumb.webp, assets/)
```

## Add a new game (2 steps)

1. Upload the game in its own folder, e.g. `memory/index.html` (+ `memory/thumb.webp`, 480x360, 4:3).
2. Add one entry to `games.json`:

```json
{
  "id": "memory",
  "name": "Ninja Memory",
  "tagline": "Find the hidden ANON pairs",
  "path": "memory/",
  "thumb": "memory/thumb.webp",
  "category": "Puzzle",
  "tags": ["pairs", "cards"],
  "status": "live",
  "leaderboard": true,
  "scoreLabel": "Score",
  "order": "desc",
  "added": "2026-11-01"
}
```

Fields:
- `status`: `live` (playable), `soon` (greyed "Coming soon" tile, not clickable), `hidden` (not shown).
- `order`: `desc` = higher score is better (default), `asc` = lower is better (e.g. fastest time).
- `added`: shows a green NEW badge for 14 days.
- `category`: categories become filter chips automatically. Search + chips appear once there are more than 6 games.
- To turn a "coming soon" tile into a real game, add `path`, `thumb`, set `status` to `live`.

Deep links: `?game=solitaire` opens a game straight away; `?tab=leaderboards&game=solitaire` opens its board.

## Inside each game

```html
<a class="back-btn" href="../">&larr; Arcade</a>          <!-- show it when ?hub=1 or framed -->
<script src="../shared/leaderboard.js"></script>
<script>
  // on a win:
  ANONLB.submit({ game: 'memory', score, time: seconds, moves, mode: 'easy' })
        .then(r => showStatus(r.message));             // r.status: online | local | rejected | skipped | error
  // a leaderboard button:
  ANONLB.openBoard('memory', { title: 'Ninja Memory' });
</script>
```
The Arcade opens games as `<path>?hub=1` so the game knows to show "← Arcade".

New game with a leaderboard? Also add its sanity rules in two places:
- `RULES` near the top of `shared/leaderboard.js` (client check)
- a `check` constraint in `supabase-setup.sql` (server check), e.g.
  `alter table public.scores add constraint scores_memory_ok check (game <> 'memory' or (time_seconds >= 10 and moves >= 8));`

## Global leaderboard (Supabase, free tier)

1. Create a free project at supabase.com.
2. SQL Editor → New query → paste all of `supabase-setup.sql` → Run.
3. Project Settings → API keys (or the Connect button): copy the **Project URL** and the **Publishable key**
   (`sb_publishable_...`; the legacy `anon public` key `eyJ...` also works).
4. Paste them into the two lines at the top of `shared/leaderboard.js`:
   `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Never use the secret / service_role key.

Until those are filled in, every game keeps working and the boards show on-device scores with a small note.

What the database allows: anyone can add a score and read scores; nobody can edit or delete through the
website. Server rules reject impossible scores (Solitaire: under 60 seconds, under 52 moves, or above the
maximum points for that time), bad nicknames, and more than 5 scores per nickname per minute.
To remove a score yourself: Supabase → SQL Editor → `delete from public.scores where id = 123;`

Free-tier note: Supabase pauses free projects after about a week with no activity. Normal daily play keeps
it awake; if it does pause, press "Restore" in the dashboard. Games fall back to on-device scores meanwhile.

### Honest limits
This is a no-login, browser-only leaderboard. The checks stop casual and accidental nonsense, but a
determined person can still send a fake score that stays inside the rules (the public key and game code are
visible to everyone, as on any website). Nicknames are not reserved: two people can pick the same name.
Treat it as a fun board, not a prize ladder. Logins / signed scores would be the next step if prizes are ever involved.

## Testing
`node tests/test-arcade.js` (headless Chrome + Playwright) checks the hub on a phone and inside a 520x760
iframe, opening/returning from Solitaire, deep links, a fake 20-game list, on-device fallback, and the exact
Supabase requests against a mock server.
