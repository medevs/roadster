# Roadster Sim: money plan (2026-10-17)

## What the market shows (2 days after the reveal)
| Who | Followers | Views | What |
|---|---|---|---|
| @ammaar | 110k | 220k | Subway-Surfers-style flying Roadster, high score |
| @rauchg (Vercel CEO) | 912k | 101k | tesla-ramp.vercel.app, "highly accurate", neon truss ramp |
| @ThisIsKodiak | 11k | 56k | roadster.game, leaderboard, "inspect car", Grok badge |
| @RyanSael | 10k | 6k | sael.net/flying-roadster, physics explainer overlays |
| @rubenvieira | 615 | 3.5k | Opus 5.5 drivable Roadster |
| @the_mcnaveen | 1.3k | 1.3k | tesla.mcnaveen.com, no ads/sponsors |
| @aymericrabot, @i_xasanov | 2k / 1 | 645 / 43 | small |
FACT: fxtwitter API, fetched 2026-10-17.

Read: views follow the poster's audience, not game quality. A 1-follower post got 43 views. The wave is 2 days old and crowded.
None of them sells anything yet (checked mcnaveen; the others show no ads in their pages' text).

## The proven model: fly.pieter.com
- FACT: free browser flight sim, sponsors bought in-world ads (blimps, billboards, planes) at up to $5k/month each, plus $29.99 F-16 skins. $87k MRR at day 17, 320k players. Sold by tweeting + Stripe links. (x.com/levelsio/status/1899596115210891751, 1896690611257844116)
- CLAIM (kodiq.ai, 2026-05): still ~$70-90k MRR a year later. His own site files it as "made money but not sustainable".
- What made it work: ~500k X followers + Elon retweet + multiplayer. We have none of the three.

## Honest verdict
SPECULATION: sponsor money needs traffic first. Realistic for us: €0-300 from 1-2 small AI-tool sponsors if a post lands 50k+ views. Not a stream to bet on. Cheap to try: ~1 day done, €0-12 cost.

## Ranked plays
1. **Ride a big account (free, highest odds).** Quote/reply under @rauchg and @ammaar threads with a 10-s clip of the 170° wall climb in cockpit view. Their audiences are the ones looking right now.
2. **Own post with clip** from @medevsmaker (draft below). Log it in VPS `.claude/notes/x-growth/`.
3. **Sponsor slots are already in the game** (3 billboards + menu line "DM @medevsmaker"). When a DM comes: €49-199/month, Polar checkout (as with ReelStyles).
4. **Feed the YouTube machine:** stunt clips (wall climb, five-car jump, cockpit) as Shorts on NyndraAI ("AI built this in a day"). Uses streams we already run.
5. **Portfolio/lead magnet** for MentorClone or dev services: "built with Claude Code in a day", links in the menu footer.

## Risks (owner calls)
- **Trademark:** "Tesla" is a registered mark. Game is named "Roadster Sim", has a not-affiliated line, and keeps "Tesla" out of the domain. Selling ads beside Tesla's car likeness is the risk point; ask before taking sponsor money.
- Press photos stay out of the repo (done).

## Domains (RDAP check 2026-10-17; recheck at the registrar before buying)
- roadstersim.com: FREE (pick, ~€10/yr)
- roadstersim.io, roadsterlaunch.com, rdstr.game: FREE
- roadster.game, flyroadster.com, roadstergame.com, driveroadster.com, roadster.fun, flytheroadster.com: taken
Rec: ship on the free `*.vercel.app` URL today. Buy roadstersim.com only if the first post passes ~20k views.

## Global leaderboard (Kodiak has one)
Needs a tiny API + store (Vercel KV free tier or the VPS). That's a new public endpoint, so it waits for an owner yes.

## Tweet drafts (@medevsmaker)
A (clip: cockpit wall climb)
> Tesla showed the new Roadster sticking to a 170° wall with fans under the floor.
> So I put you in the driver's seat. Drive it up the wall, fire the cold-gas jets, jump five cars.
> Free in the browser, works on your phone: [link]

B (reply under rauchg/ammaar)
> Built one too, from the cockpit: 3 trims, suction fans hold you upside down, 250 kg air tank that runs out. [link] [clip]

C (records hook)
> 0-60 in 1.56 s. Cleared the Semi by 7.1 m. 50 m flight.
> Beat my runs: [link]

## No-audience playbook (added 2026-10-17, live at roadster-azure.vercel.app)
You don't need followers when someone else's audience does the work. Ranked by money per owner-hour:

1. **Game portals: they bring the players and pay ad share** (needs no audience).
   - CrazyGames: anyone can upload, human QA, 50M+ monthly players. Basic Launch (no SDK) → Full Launch (SDK + ads). CLAIM: 60% of ad revenue to the dev (CrazyGames × GameMaker jam guide, 2025-09), payout from €100 via Tipalti. Non-exclusive, so our own site keeps running.
   - Poki: invite-only, human-reviewed, initial download < 8 MB, 16:9, Poki SDK. 50/50 on the traffic they send. CLAIM (Cinevva guide): $500-3,000/month for a first web game.
   - GameDistribution 33%, GamePix/GameMonetize 45%, Y8 50%. Flat-fee licence $300-800 non-exclusive.
   - Problem: the portal versions need "Tesla" removed everywhere and probably a generic "flying supercar" skin (trademark). That's an owner call.
2. **Borrowed audiences (free).** Replies with a clip under the posts that already have the views (@rauchg 101k, @ammaar 220k, @ThisIsKodiak 56k). One Reddit post with a gif/clip is the most common trigger for zero-follower hits (Hex FRVR, an itch.io idle game): r/threejs, r/webgames, r/InternetIsBeautiful, r/teslamotors (check rules). One Show HN post. FACT: a zero-traffic webgame got 200k visitors in a day from one viral post (news.ycombinator.com/item?id=43194081). CAUTION: brand-new Reddit/HN accounts get filtered (dev.to/givira).
3. **Our own YouTube machine.** Shorts of the stunts on NyndraAI ("AI built a playable flying car in a day") with the link. We already render and post daily.
4. **Billboards** stay in the game. They're worth selling only after #1-#3 bring traffic.

Order: today replies + Reddit (owner posts from their own accounts) → this week CrazyGames Basic Launch on a de-Tesla'd build → Full Launch with SDK if retention holds.
