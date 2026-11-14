/* Game Theatre skins - one world per quick game (Farin 2026-11-14: "i want each game to get its own design and full screen ...
   you can consider the posters as their reference and inspiration"). Byte-identical in english app/app/games/theatre/ and
   spanish app/app/games/theatre/ (no language in here: poster titles and taglines live in each app's content.js).

   theatre.js reads window.THEATRE_SKINS[kind] for any kind the app opens. A skin gives the game:
     card      its live roadmap card poster (art/posters/card-<kind>.webp, 960x480). Until a kind has portrait key art of its own
               (content.js art + artReady:true), the poster intro shows this card art in the wide layout.
     focus     where the subject sits in the card art, as the x of object-position ('72%'): the poster plate is cropped around it.
     palette   {sky, sky2, glow, ground, ink, accent, accentInk}, picked from the poster: the poster, the leave sheet, the HUD tint
               and the world behind the game use it. The game's own components keep the app's design system.
     backdrop  {src, position, blur, veil}: the world behind the game while it runs. src null = the card art. blur in px (0 = a crisp
               illustrated backdrop), veil 0..1 = how much of the palette's sky lies over it so the game stays easy to read.
     props     [{src, at:'tl'|'tr'|'bl'|'br', w:'34%', h, opacity}]: corner props drawn in the game column, behind the game.
   The per-game world designs (farin-gamification, Claude/specs/games-own-worlds-2026-11-14/SPEC.md) drop in here:
     gw        the World Kit colours (SPEC 4.5): bg (flat, until the plate is ready), surface (the panel), paper (every surface with
               text), ink, hue, accent, cta / ctaInk (the action bar; contrast checked in the spec)
     world     the World Kit place (SPEC 4.3/4.4/4.10/4.14): stage (--gw-stage height), plate {src, pos, ready}, layers (cut-outs
               {src, cls, id, box:[x%, y%, w%], ready}), text (live text on the art {text, cls, id, box, ready}, never mirrored), sfx
               ({name:[files]} over the shared CC0 kit), css (games/worlds/<kind>/world.css once it exists). Only ready:true art shows.
   The world is on per kind with the app's WORLDS_LIVE switch (?worlds=1 previews all); with it off the game plays over the soft
   backdrop above. Anything a skin needs beyond tokens goes in its world.css under body.gw-on.gw-<kind>. */
window.THEATRE_SKINS = {
  // Word Rush: the card table under the porthole, butter yellow, one red apple card
  match:{card:'art/posters/card-match.webp', focus:'86%',
    palette:{sky:'#fcf9de', sky2:'#f2ebb2', glow:'#fffbea', ground:'#f3d47c', ink:'#3a3212', accent:'#d23f2d', accentInk:'#ffffff'},
    backdrop:{src:null, position:'70% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#fff3c4', surface:'#e7c48e', paper:'#ffffff', ink:'#14332e', hue:'var(--cat-review)', accent:'#FF6F5E', cta:'#14332e', ctaInk:'#ffffff'},
    world:{stage:'clamp(120px, 24dvh, 240px)', plate:{src:'games/worlds/match/art/match-cabin.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}},
  // Build It: the workshop shelf, warm sand and wooden blocks
  build:{card:'art/posters/card-build.webp', focus:'66%',
    palette:{sky:'#fcf2dc', sky2:'#f1daa8', glow:'#fff8ea', ground:'#e1b77d', ink:'#3b2a14', accent:'#cc5428', accentInk:'#ffffff'},
    backdrop:{src:null, position:'66% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#fbe7c2', surface:'#e2b77c', paper:'#fffaf0', ink:'#14332e', hue:'var(--cat-gram)', accent:'#FF6F5E', cta:'#1f7a6d', ctaInk:'#ffffff'},
    world:{plate:{src:'games/worlds/build/art/build-workshop.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}},
  // Mini Cross: the cafe table crossword by the window, mint table, cream wall
  cross:{card:'art/posters/card-cross.webp', focus:'64%',
    palette:{sky:'#f7f2e6', sky2:'#dfead2', glow:'#fffaf1', ground:'#92cfa6', ink:'#1f3a2e', accent:'#1d8f76', accentInk:'#ffffff'},
    backdrop:{src:null, position:'64% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#f9dcc0', surface:'#5FC9B8', paper:'#fbf8f0', ink:'#14332e', hue:'var(--cat-voc)', accent:'#c8352e', cta:'#14332e', ctaInk:'#ffffff'},
    world:{stage:'clamp(110px, 22dvh, 220px)', plate:{src:'games/worlds/cross/art/cross-table.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}},
  // Order Up!: Sam's harbour cafe, sea blue, the red-and-orange awning
  order:{card:'art/posters/card-order.webp', focus:'80%',
    palette:{sky:'#ecf6f7', sky2:'#c9e3e6', glow:'#fff8ec', ground:'#7dcce5', ink:'#1d2f36', accent:'#c43428', accentInk:'#ffffff'},
    backdrop:{src:null, position:'78% 50%', blur:30, veil:.54}, props:[],
    gw:{bg:'#fdf3e4', surface:'#e9c48f', paper:'#fffaf0', ink:'#14332e', hue:'var(--cat-gram)', accent:'#d8343f', cta:'#d8343f', ctaInk:'#ffffff'},
    world:{plate:{src:'games/worlds/order/art/order-counter.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}},
  // Passport Desk: the booth at the end of the pier, sky, sea teal, the red-striped booth
  desk:{card:'art/posters/card-desk.webp', focus:'64%',
    palette:{sky:'#e9f8fc', sky2:'#b9e6f2', glow:'#ffffff', ground:'#5fc3cc', ink:'#163450', accent:'#c23a32', accentInk:'#ffffff'},
    backdrop:{src:null, position:'64% 50%', blur:30, veil:.54}, props:[],
    gw:{bg:'#e8f6fd', surface:'#e3c595', paper:'#fffdf7', ink:'#13304d', hue:'var(--clay-sky)', accent:'#c8352e', cta:'#13304d', ctaInk:'#ffffff'},
    world:{stage:'clamp(180px, 34dvh, 340px)', plate:{src:'games/worlds/desk/art/desk-booth.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}},
  // Magic Words: the golden door in the rose room
  spell:{card:'art/posters/card-spell.webp', focus:'84%',
    palette:{sky:'#fcf2f8', sky2:'#efd5e5', glow:'#fff4d6', ground:'#eca560', ink:'#3a2342', accent:'#f0b232', accentInk:'#3a2342'},
    backdrop:{src:null, position:'82% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#efe8fb', surface:'#f5eee1', paper:'#fff3d2', ink:'#2a1d55', hue:'var(--clay-lavender-deep)', accent:'#f2b632', cta:'#f2b632', ctaInk:'#2a1d55'},
    world:{stage:'clamp(220px, 44dvh, 420px)', plate:{src:'games/worlds/spell/art/spell-corridor.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}},
  // Word Bingo: the bingo card on the kitchen table, cream, wood, red dots
  bingo:{card:'art/posters/card-bingo.webp', focus:'66%',
    palette:{sky:'#fbf7e6', sky2:'#ece4c6', glow:'#fffdf4', ground:'#d1a77d', ink:'#3a2c1c', accent:'#d9463a', accentInk:'#ffffff'},
    backdrop:{src:null, position:'66% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#f3f6d9', surface:'#e8c99a', paper:'#ffffff', ink:'#14332e', hue:'var(--cat-voc)', accent:'#FF6F5E', cta:'#14332e', ctaInk:'#ffffff'},
    world:{stage:'clamp(150px, 26dvh, 260px)', plate:{src:'games/worlds/bingo/art/bingo-window.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}},
  // Story Hunt: the open storybook and the magnifier in the library, sage and paper
  hunt:{card:'art/posters/card-hunt.webp', focus:'56%',
    palette:{sky:'#f0f4f0', sky2:'#d5ded7', glow:'#fffaef', ground:'#bfab86', ink:'#26332c', accent:'#bf513e', accentInk:'#ffffff'},
    backdrop:{src:null, position:'56% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#d6ebf7', surface:'#e8c48c', paper:'#fffaf0', ink:'#14332e', hue:'var(--cat-story)', accent:'#d8343f', cta:'#14332e', ctaInk:'#ffffff'},
    world:{stage:'clamp(96px, 18dvh, 180px)', plate:{src:'games/worlds/hunt/art/hunt-library.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}},
  // Say It Back: the echo between two voices, rose wall, teal
  echo:{card:'art/posters/card-echo.webp', focus:'68%',
    palette:{sky:'#fdf1ee', sky2:'#f2d0c9', glow:'#fff7f2', ground:'#5fb3a8', ink:'#2f2422', accent:'#0d8f87', accentInk:'#ffffff'},
    backdrop:{src:null, position:'68% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#f7d3d6', surface:'#f3e9e2', paper:'#fffaf0', ink:'#14332e', hue:'var(--cat-lis)', accent:'#e8402f', cta:'#14332e', ctaInk:'#ffffff'},
    world:{stage:'clamp(170px, 34dvh, 340px)', plate:{src:'games/worlds/echo/art/echo-studio.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}},
  // Listen & Type: headphones at the window over the harbour, soft grey-rose, orange headphones
  dictation:{card:'art/posters/card-dictation.webp', focus:'76%',
    palette:{sky:'#f8f3f1', sky2:'#e5dad5', glow:'#fffaf7', ground:'#b79984', ink:'#2f2a28', accent:'#cc6428', accentInk:'#ffffff'},
    backdrop:{src:null, position:'76% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#fbd9d3', surface:'#f1e4d6', paper:'#fbf6e6', ink:'#14332e', hue:'var(--cat-lis)', accent:'#FFA53D', cta:'#14332e', ctaInk:'#ffffff'},
    world:{plate:{src:'games/worlds/dictation/art/dictation-room.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}},
  // Trap Dash: the run to the striped barrier at the pier end, pale sky, sea
  trap:{card:'art/posters/card-trap.webp', focus:'60%',
    palette:{sky:'#f0f9f9', sky2:'#cbeceb', glow:'#ffffff', ground:'#86d8d8', ink:'#173638', accent:'#d4463a', accentInk:'#ffffff'},
    backdrop:{src:null, position:'60% 50%', blur:30, veil:.54}, props:[],
    gw:{bg:'#eef8f8', surface:'#e3c595', paper:'#ffffff', ink:'#173638', hue:'var(--cat-gram)', accent:'#d4463a', cta:'#173638', ctaInk:'#ffffff'},
    world:{plate:{src:'games/worlds/trap/art/trap-pier.webp', pos:'50% 50%', ready:false}, layers:[], text:[], sfx:{}, css:null}}
};
