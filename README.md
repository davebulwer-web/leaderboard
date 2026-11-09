# Pin High

A retro golf game played from behind the golfer, in the spirit of the mid-80s pseudo-3D golf games, with modern pixel art. The courses come from the course generator in Fairway Pixels (`davebulwer-web/golf`), so every seed and style gives a new 18 holes. The golfer stands side on, as in the originals, and every shot (putts too) uses the same camera, set so he draws at the art's own pixel size with hills, doglegs, bunkers, water and woods.

![Teeing off](screenshots/03-tee.png)

## Playing

Download `pin-high.html` and open it in a browser. It's one self-contained file.

Pick 1 to 4 players (each with a name and shirt colour), a level, and a course: either one of the named courses from Fairway Pixels' course list, or a random course from any of the eight styles (parkland, links, desert, heathland, alpine, tropical, woodland, stadium) and a seed. Then play 18 holes, the front 9 or the back 9 from the forward, white, blue or championship tees.

- **Aim:** left/right arrows (hold Shift for fine aim), or drag sideways on the view. The view turns with your aim, and the yellow marker shows where a full shot with that club carries on flat, calm ground.
- **Club:** up/down arrows or the mouse wheel. A club is picked for you each shot. On the green, up/down changes the putter's range (9 to 108 feet).
- **Swing:** hold space (or the mouse button on the view) and the power climbs up the meter; let go to set it (past 100% is an overswing: longer but wild). The marker then drops into the SNAP section at the bottom of the meter: press as it crosses the white snap line. Early hooks the ball left, late slices it right, so a deliberate early or late snap is how you draw or fade a shot. The green band is how forgiving the snap is at your level.
- **Putting:** power only: hold and let go. The marker by the hole is a little post whose shadow falls the way the green slopes, longer where it's steeper. The panel shows how far up or down the hole is, and Novices get a tick on the meter for the hole's distance on a flat green.
- **Wind:** the compass shows it relative to your aim. Novice has no wind.
- **Ball cam:** once the golfer has finished his swing the camera chases the ball: close behind a putt, and above and behind a full shot. `C` turns it off for full shots (putts always follow).
- `Tab` shows the scorecard, `M` turns sound off, `Esc` goes back to the title. Holding space during a shot speeds it up.

Whoever is farthest from the hole plays next; the best score on a hole has the honour on the next tee. Water costs a stroke (drop back on dry land), out of bounds (past the woods at the edge of the hole) is stroke and distance, and you pick up after ten.

Levels: **Novice** (no wind, wide snap band, slower meter, putting line), **Amateur** (wind), **Pro** (stronger wind, tight snap, faster meter).

## How it works

Plain JavaScript and a canvas, no engine or libraries.

- `src/gen/`: the course generator and its helpers, copied unchanged from Fairway Pixels (`course-generator.js`, `course.js`, `course-map.js`, `terrain.js`, `weather.js`, `course-list.js`, at commit `ebb5758`). If the generator changes there, copy these files across again.
- `src/world.js`: turns a generated hole into a one-yard grid of surfaces and heights, plus the trees and bushes standing on it.
- `src/render.js`: the 3D view. The ground is drawn like a voxel-landscape engine: each screen column marches out from the camera and fills upwards wherever the ground shows, so hills hide what's behind them. Trees, the flag and the ball are scaled sprites tested against a depth buffer. Colours are lit from the slope, lightly dithered and fade into the haze.
- `src/physics.js`: clubs, ball flight (drag, backspin lift, side spin from the snap, wind), bounces, rolling down slopes, trees, water, out of bounds and the cup.
- `src/main.js`: the game: menus, turns, the swing meter, the panel, the minimap and the scorecard.
- `src/styles.js`: ground colours, trees and haze for each course style.
- `src/sprites.js`, `src/assets.js`: the art (packed by `tools/pack-assets.py`); golfers are recoloured per player.
- `src/font.js`, `src/audio.js`: bitmap fonts and synthesised sounds.

`index.html` loads the modules directly (needs a local web server, e.g. `npx serve`). After changing anything in `src/`, rebuild the single file with `node tools/build.mjs`. `node tools/shots.cjs` and `node tools/shots2.cjs` save screenshots (they need Playwright).

## Art

All the art was made with [Pixellab](https://pixellab.ai): the golfer's address pose, swing and putting stroke (animated from the address pose), eleven trees, four bushes, the flag and a horizon backdrop for each course style. The swing is side on with the arms extended to the ball and the head down on it until impact: the backswing and putting stroke are posed with Pixellab's skeleton animation (`tools/skeleton-swing.py`, one skeleton per frame), and the follow-through turns into a finish seen from behind (`tools/finish-pose.py`, joined to impact with Pixellab's first-and-last-frame animation in `tools/follow-through.py`). The originals are in `assets/raw`; `tools/pl.py`, `tools/gen-scenery.sh` and `tools/gen-backdrops.sh` regenerate them (they need `PIXELLAB_API_KEY`), and `python3 tools/pack-assets.py` packs them into `src/assets.js`.

![Alpine](screenshots/07-alpine-bunker.png)
![Desert](screenshots/08-desert-tee.png)
