# Pocket Gridiron 🏈

An original, offline-first, pixel-art American football game with franchise mode, built as a Progressive Web App for iPhone (Safari → Add to Home Screen) and hosted on GitHub Pages.

- No build step, no frameworks, no CDNs, no servers. Plain HTML/CSS/JavaScript (ES modules).
- All graphics (players, field, font, icons) and sounds are generated in code. There are no external assets.
- After the first visit, the service worker caches every file and the game runs fully offline.
- Franchise saves live on the device in IndexedDB, with JSON export/import for backups.

---

## Project layout

```
index.html               App shell, iOS PWA meta tags
manifest.webmanifest     Name, icons, landscape, fullscreen
sw.js                    Service worker (precache + offline)
.nojekyll                Tells GitHub Pages to serve files as-is
css/style.css            Retro UI, safe-area handling, rotate prompt
icons/                   Home Screen icons (180, 192, 512, maskable)
js/
  main.js                Boot, canvas scaling, game loop, touch routing, SW registration
  engine.js              STAGE 1: on-field football engine (offense, AI defense, kicking, clock, OT)
  sprites.js             Pixel font, player sprites, field, goal posts
  audio.js               Synthesized sound effects (WebAudio)
  sim.js                 Opponent drive + league game simulation
  data.js                Fictional teams, names, routes, playbook
  util.js                Helpers
  franchise.js           STAGE 2: league, season, playoffs, draft, development, contracts
  storage.js             STAGE 2: IndexedDB save slots, export/import, settings
  ui.js                  Menus and all franchise screens
```

---

## Stage 1: Playable football prototype (Quick Play)

**What's in it:** an exhibition game with real-time offense against an AI defense.

- **Play calling:** each down you get 4 cards (3 passes + 1 run) with route diagrams. On 4th down (or late in a half) you can also punt or kick a field goal; success odds are shown.
- **Passing:** after the snap, touch and **drag backwards** like a slingshot. A dotted arc and target ring show the throw; release to throw. Arm strength sets range and ball speed; accuracy and pass-rush pressure add error. A coloured marker over each receiver shows separation (green/yellow/red).
- **Receivers** run real routes (go, slant, out, dig, curl, post, corner, comeback, drag, flat, wheel, seam, hitch) and adjust to the ball in the air.
- **Defense AI:** a 4-3 with man coverage that reacts with rating-based lag, a deep safety, hook-zone linebackers, random blitzes, linebackers biting on play-action, and an OL/DL pass rush that collapses the pocket.
- **Catch resolution:** contested catches, pass breakups, drops and interceptions depend on separation, hands and coverage ratings.
- **Running:** the ball carrier sprints automatically. **Hold above or below him to steer.** Quick swipes: up/down = juke, right = dive, left = spin. Blockers engage defenders downfield, and tackles can be broken.
- **Rules:** downs and distance, first-down line, touchdowns, extra point or 2-point try, field goals, punts, sacks, safeties, interceptions, turnover on downs, out of bounds, 4 timed quarters, halftime, and overtime.
- **Opponent possessions** are simulated from their offense rating vs your defense, with a summary card.

### How to test Stage 1

1. Run locally (any static server works):
   ```bash
   cd pocket-gridiron
   python3 -m http.server 8000
   ```
   Open `http://localhost:8000` in Chrome or Safari. Use DevTools device mode in landscape (e.g. iPhone 14, 844×390) with touch emulation on.
2. Tap **QUICK PLAY**, pick your team, pick an opponent, then tap **KICK OFF**.
3. Check that:
   - Play cards appear at the bottom; tapping one snaps the ball.
   - Dragging backwards draws the aim arc; releasing throws; the ball arcs and lands at the ring.
   - Completions turn the receiver into a runner you can steer by holding above/below; swipes trigger JUKE/DIVE/SPIN popups.
   - **HB DIVE / SWEEP / STRETCH** hand off to the running back.
   - **QB RUN** (bottom-left) lets the quarterback scramble.
   - The scoreboard, clock and down & distance update; 4th down shows PUNT / FIELD GOAL.
   - **II** pauses; rotating to portrait shows the rotate prompt and pauses the game.
4. In Safari's Web Inspector console (or Chrome DevTools) there should be no errors. `window.pocketGridiron` gives you the app object for debugging.

> Testing on your iPhone over Wi-Fi (`http://<your-computer-ip>:8000`) works for gameplay, but service workers only run on **HTTPS** or `localhost`, so offline mode and installation should be tested on GitHub Pages (below).

---

## Stage 2: Franchise mode, progression and saves

- **16 fictional teams**, each with a generated 31-man roster (QB, RB, WR, TE, OL, DL, LB, DB, K). Player attributes: speed, agility, strength, hands, arm, accuracy, blocking, tackling, coverage, kick power and kick accuracy. OVR is weighted by position, and every player has a hidden potential.
- **Your actual starters play on the field.** Their attributes drive speed, catching, throwing, blocking and tackling in the engine, and team ratings drive the simulations.
- **Season:** a 15-week round-robin. Every other game is simulated, and standings use win percentage, then point differential.
- **Playoffs:** the top 8 make it, playing quarterfinals, semifinals and the **Pocket Bowl**. Championships and history are tracked.
- **Coaching credits (CC):** earned from wins (+2), losses (+1), playoff wins (+3), a title (+5) and each new season (+2). Spend them to train a player's key attributes (cost rises with the rating; young players gain more) or to scout draft prospects.
- **Offseason:** players age and progress (young players grow toward potential, veterans decline), retirements happen, contracts expire (re-sign or let go under a **$125M cap**), then a **3-round draft** with scouted OVR ranges and potential grades, then **free agency**, then a new season.
- **Saves:** 3 IndexedDB slots with auto-save after every game and decision. **EXPORT** shares or downloads a `.json` file (or copies it as text), and **IMPORT** restores from a file or pasted text into any slot.
- **Settings:** sound, aiming style (pull-back or touch-target), quarter length (2–5 min), and difficulty (Rookie / Pro / Legend).

### How to test Stage 2

1. **FRANCHISE → NEW FRANCHISE** (slot 1) → pick a team → **START FRANCHISE**.
2. On the hub, open **ROSTER** → tap a player → press a **+ CC** button. The attribute and OVR rise and the credits drop.
3. **PLAY GAME** for a real game, or **SIM GAME** to simulate. Confirm the record, CC, standings and schedule update. Player season stats appear on player cards after played games.
4. Keep simulating until the playoffs. Check **BRACKET**, then sim or play through to the **Pocket Bowl**.
5. **BEGIN OFFSEASON**: check the offseason report, **RE-SIGN** or **LET GO** expiring players, then the draft (**SCOUT**, **SIM TO MY PICK**, **DRAFT**), then free agency (**SIGN**), then **START NEXT SEASON**.
6. Saves:
   - **SAVE & EXIT**, reload the page, and **CONTINUE** returns to the same state.
   - **FRANCHISE → EXPORT** a slot, then **IMPORT SAVE FILE** (file or pasted text) into another slot. The imported franchise loads identically.

---

## Deploy to GitHub Pages

1. Create a new repository on GitHub (e.g. `pocket-gridiron`). It can be public, or private on a plan that allows Pages.
2. Upload the **contents** of this folder to the repository root, so that `index.html` sits at the top level and `.nojekyll` is included:
   ```bash
   cd pocket-gridiron
   git init
   git add .
   git commit -m "Pocket Gridiron v1.0.0"
   git branch -M main
   git remote add origin https://github.com/<you>/pocket-gridiron.git
   git push -u origin main
   ```
   (Or drag the files into GitHub's **Add file → Upload files** page.)
3. In the repo, go to **Settings → Pages → Build and deployment**, set **Source: Deploy from a branch** and **Branch: `main` / `(root)`**, then **Save**.
4. After a minute the site is live at `https://<you>.github.io/pocket-gridiron/`. All paths are relative, so it works under the repo sub-path.

### Install on iPhone

1. Open the GitHub Pages URL in **Safari** (not an in-app browser).
2. Wait for the title screen footer to say **OFFLINE READY ✓**. That means every file is cached.
3. Tap **Share → Add to Home Screen → Add**.
4. Launch it from the Home Screen icon. It opens full-screen in landscape.
5. **Offline test:** turn on Airplane Mode, force-quit the app, and launch it again. It should start and play normally, and your franchise saves stay on the device.

### Shipping updates

Whenever you change any file, **bump `VERSION` in `sw.js`** (e.g. `pg-1.0.1`) and update the version in `js/main.js`, then push. The next time the installed app is opened online, the title screen shows **UPDATE AVAILABLE — TAP TO RELOAD**. Saves are untouched by updates.

If you add a new file, add it to the `ASSETS` list in `sw.js` so it is cached for offline use.

---

## Notes and limits

- iOS keeps Home Screen app storage separate from Safari's, so a save made in Safari won't appear in the installed app. Use export/import to move it. Export regularly as a backup: deleting the Home Screen app deletes its data.
- Simulated games (SIM GAME, the rest of a game) update records but not individual player stats.
- Leaving the app in the middle of a game doesn't save that game; it can simply be replayed from the hub.
- Ideas for later: injuries, player morale, facilities upgrades, a playable defense, more formations, and an audible button.

All teams, names, art and code are original to this project.
