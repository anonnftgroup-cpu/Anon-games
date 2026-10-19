# ANON Arcade · "Challenge a friend"

Files: `shared/challenge.js` + `shared/challenge.css` (the JS loads the CSS itself).

## What it does
- **Game over:** a green **⚔️ Challenge a friend** button appears on the result card, just under the
  leaderboard message (the newsletter pop-up and score posting are untouched).
  It shares the game's public link with `?ch=<nickname>&s=<score>`:
  `https://anonnftgroup-cpu.github.io/Anon-games/<game-folder>/?ch=Shadow-Fox-42&s=1240`
  - Phones: the native share sheet (`navigator.share`).
  - Otherwise (or inside the anonnfts.com iframe): Copy link · Post on X · WhatsApp · Facebook, plus the link in a box.
  - Text, e.g. `I scored 1,240 on ANON Snake 🐍 Think you can beat me? #ANONArcade`. No money, value or backing claims, ever.
- **Opening a challenge link:** a banner `<name> scored <score>. Can you beat it?` (fades after 10 s).
  At the next game over the card shows `🏆 You beat <name>!` or `<n> short of <name>`, and the button becomes **⚔️ Challenge back**.
  The challenge is remembered for the tab session, so replays still compare.
- **Safety:** the name is shown with `textContent` only, limited to `A-Z a-z 0-9 space _ . -`, max 20 characters, and run through the
  leaderboard name filter (blocked names show as "A friend"). The score must be digits only (max 9), otherwise no banner.

## Adding it to a game
**Nothing to do if the game includes `../shared/leaderboard.js` and posts its score with `ANONLB.submit()`**
(directly or through `AK.post`, `RK.shell` or `BK`). `leaderboard.js` loads `challenge.js` and the button
appears automatically for any score above 0. It finds the result card by `#lbMsg`, `#wLB`, `.lbmsg`, `.wlb`, or an open
`.modal.show .mcard` / `.overlay.show .panel`; if there is none it shows a small floating card.

**Custom result screens / custom share text** (one script tag + one call):
```html
<script src="../shared/challenge.js"></script>
```
```js
ANONChallenge.onGameOver({
  game: 'my-game',          // the games.json id
  score: 1240,              // number to beat
  lowerIsBetter: false,     // true for time-only scores (default: games.json "order": "asc")
  mount: resultCardElement, // optional: where to put the button
  text: 'optional custom share text #ANONArcade', // optional
  label: 'Score'            // optional: 'Streak' / 'Series' changes the wording
});
```
Calling `onGameOver` once for a game switches off the automatic button for that game on that page.
Call `ANONChallenge.manual('my-game')` to switch it off without showing anything (e.g. a lost round with no score).

Other helpers: `ANONChallenge.challenge()` (the active `{name, score}` or null), `ANONChallenge.link(nick, score)`, `ANONChallenge.url`.

## Special cases already wired
- **Daily ANON Word:** shares the emoji grid (`Daily ANON Word #12 3/6` + 🟨🟪⬛ rows), never the answer. A lost word shows no challenge.
- **Word Unlimited:** shares the win streak (current streak after a win, best streak after a loss), emoji grid only.
- **Four in a Row, Tic-Tac-Toe, Chess, Checkers, Hearts:** they post a score only when you win vs the computer, so the button shows after a win.
  2-player (pass-and-play) games and losses have no score, so no challenge is shown.
- All current leaderboards are "higher is better" (time-based games such as Minesweeper and Jigsaw already turn time into a score),
  so they compare correctly. A future time-only board should set `"order": "asc"` in games.json or pass `lowerIsBetter: true`.
