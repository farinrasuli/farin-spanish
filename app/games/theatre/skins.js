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
     world     the World Kit place (Games 2.0 SPEC 5.1 Fit Kit; mood = a SPEC 5.3 lighting preset): band ('small' = under 240 px: the world's colour + whole cut-outs; the whole
               plate in the establishing shot), stage (the band height), plate {src, ready} (always whole: contained), bed {freq, q, vol, lfo} (a quiet procedural ambient bed), layers (cut-outs
               {src, cls, id, box:[x%, y%, w%], sit, ready}; sit = stands on the panel's top edge), text (live text on the art {text | key
               (content.js worldText), cls, id, box, ready}, never mirrored), sfx
               ({name:[files]} over the shared CC0 kit), css (games/worlds/<kind>/world.css once it exists), spots (Games 2.0 SPEC 5.4: sound
               names played now and then, every 6-14 s; 'gull' and 'clock' are made in code when no file has the name), end ({over, spot, at}: the finale keeps the
               whole place behind the end card / plays a sound such as the code-made 'horn' at ms), strip ({src, ratio, glow:[x%, y%]}: a small
               band's picture edge to edge), port ({ring, view}: a round window in a small band, its view clearing with the progress), shot ({src, ratio,
               glow}: the opening / closing shot's own whole picture), end.keep (the end beat stays in the band). Only ready:true art shows.
   The world is on per kind with the app's WORLDS_LIVE switch (?worlds=1 previews all); with it off the game plays over the soft
   backdrop above. Anything a skin needs beyond tokens goes in its world.css under body.gw-on.gw-<kind>. */
window.THEATRE_SKINS = {
  // Word Rush: the card table under the porthole, butter yellow, one red apple card
  match:{card:'art/posters/card-match.webp?v=3', focus:'86%',
    palette:{sky:'#fcf9de', sky2:'#f2ebb2', glow:'#fffbea', ground:'#f3d47c', ink:'#3a3212', accent:'#d23f2d', accentInk:'#ffffff'},
    backdrop:{src:null, position:'70% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#fff3c4', surface:'#e7c48e', paper:'#ffffff', ink:'#14332e', hue:'var(--cat-review)', accent:'#FF6F5E', cta:'#14332e', ctaInk:'#ffffff'},
    // the porthole in the band (worlds art 2026-11-19): the harbour in it clears pair by pair, whole at the end
    // the band about 136 px at 640 tall (all 12 cards show at once, 2026-11-21 review), 230 at 844; the end beat stays in the band: the porthole clears
    world:{mood:'warm', band:'small', stage:'clamp(110px, calc(46dvh - 158px), 240px)', plate:{src:'games/worlds/match/art/match-cabin.webp', ready:true}, bed:{freq:300, q:.4, vol:.03, lfo:.12},
      port:{ring:'games/worlds/match/art/match-porthole.webp', view:'games/worlds/match/art/match-harbour.webp', ready:true}, end:{keep:true}, layers:[
      {src:'games/worlds/match/art/match-back.webp', cls:'gw-deck', box:[68, 78, 12], band:[76, 0, 13], sit:true, ready:true}], text:[], sfx:{}, css:null}},   // the pile: the clean card back
  // Build It: the workshop shelf, warm sand and wooden blocks
  build:{card:'art/posters/card-build.webp?v=3', focus:'66%',
    palette:{sky:'#fcf2dc', sky2:'#f1daa8', glow:'#fff8ea', ground:'#e1b77d', ink:'#3b2a14', accent:'#cc5428', accentInk:'#ffffff'},
    backdrop:{src:null, position:'66% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#fbe7c2', surface:'#e2b77c', paper:'#fffaf0', ink:'#14332e', hue:'var(--cat-gram)', accent:'#FF6F5E', cta:'#1f7a6d', ctaInk:'#ffffff'},
    world:{mood:'warm', plate:{src:'games/worlds/build/art/build-workshop.webp', ready:true}, bed:{freq:180, q:.8, vol:.028, lfo:.07}, layers:[], text:[], sfx:{}, css:null}},
  // Mini Cross: the cafe table crossword by the window, mint table, cream wall
  cross:{card:'art/posters/card-cross.webp?v=3', focus:'64%',
    palette:{sky:'#f7f2e6', sky2:'#dfead2', glow:'#fffaf1', ground:'#92cfa6', ink:'#1f3a2e', accent:'#1d8f76', accentInk:'#ffffff'},
    backdrop:{src:null, position:'64% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#f9dcc0', surface:'#5FC9B8', paper:'#fbf8f0', ink:'#14332e', hue:'var(--cat-voc)', accent:'#c8352e', cta:'#14332e', ctaInk:'#ffffff'},
    world:{mood:'warm', band:'small', stage:'clamp(110px, 22dvh, 220px)', plate:{src:'games/worlds/cross/art/cross-table.webp', ready:true}, bed:{freq:600, q:.5, vol:.022, lfo:.09}, layers:[
      {src:'games/worlds/cross/art/cross-croissant.webp', cls:'gw-croissant', box:[16, 76, 20], band:[6, 0, 22], sit:true, ready:true},
      {src:'games/worlds/cross/art/cross-cup.webp', cls:'gw-cup', box:[68, 70, 14], band:[78, 0, 15], sit:true, ready:true}], text:[], sfx:{}, css:null}},
  // Order Up!: Sam's harbour cafe, sea blue, the red-and-orange awning
  order:{card:'art/posters/card-order.webp?v=3', focus:'80%',
    palette:{sky:'#ecf6f7', sky2:'#c9e3e6', glow:'#fff8ec', ground:'#7dcce5', ink:'#1d2f36', accent:'#c43428', accentInk:'#ffffff'},
    backdrop:{src:null, position:'78% 50%', blur:30, veil:.54}, props:[],
    // the cozy pass (2026-11-25): the panel is the honey-wood counter, brown ink, a terracotta Serve; the lamp's warm glow and a deeper
    // warm tint; the café's own sounds (a door-bell ding as a customer walks in, cups clinking and a pour now and then, a gull outside);
    // games/worlds/order/world.css styles the order pad, the balloon, the tray, the shelf and the chat. The plate is the Higgsfield 3D café
    // from behind the counter (farin-e9, 2026-11-25): open floor to the bottom edge, so no front layer and no prop cut-outs (the till and the
    // cake dome are in the picture); the glow sits on the left pendant lamp. Captain (3D since 2026-11-26) hides on the floor or on the door frame.
    gw:{bg:'#fdf3e4', surface:'#d9a868', paper:'#fffaf0', ink:'#3b2616', hue:'var(--cat-gram)', accent:'#c4472f', cta:'#c4472f', ctaInk:'#ffffff'},
    world:{mood:'warm', moodVars:{'--m-gx':'44%', '--m-gy':'10%', '--m-gr':'58%', '--m-ga':'.32', '--m-ta':'.06', '--m-vig':'.12'}, plate:{src:'games/worlds/order/art/order-counter.webp', ready:true}, bed:{freq:420, q:.5, vol:.03, lfo:.09},
      spots:['cafe-clink', 'gull', 'cafe-pour'], layers:[], text:[],
      sfx:{'door-ding':['games/cozy-chores/sfx/ding-1.mp3', 'games/cozy-chores/sfx/ding-2.mp3'], 'cafe-clink':['games/cozy-chores/sfx/clink-1.mp3', 'games/cozy-chores/sfx/clink-2.mp3', 'games/cozy-chores/sfx/clink-3.mp3'],
        'cafe-pour':['games/cozy-chores/sfx/pour-liquid-1.mp3', 'games/cozy-chores/sfx/pour-liquid-2.mp3']}, css:'games/worlds/order/world.css?v=2'}},
  // Passport Desk: the booth at the end of the pier, sky, sea teal, the red-striped booth
  desk:{card:'art/posters/card-desk.webp?v=3', focus:'64%',
    palette:{sky:'#e9f8fc', sky2:'#b9e6f2', glow:'#ffffff', ground:'#5fc3cc', ink:'#163450', accent:'#c23a32', accentInk:'#ffffff'},
    backdrop:{src:null, position:'64% 50%', blur:30, veil:.54}, props:[],
    gw:{bg:'#e8f6fd', surface:'#e3c595', paper:'#fffdf7', ink:'#13304d', hue:'var(--clay-sky)', accent:'#c8352e', cta:'#13304d', ctaInk:'#ffffff'},
    // the band about 30dvh on a phone (one screen per round, 2026-11-19 re-review): 140 px at 640 tall, 253 at 844, 292 at 915
    // 3D booth (Higgsfield, farin-e9, 2026-11-26): the booth from the pier, its window on the right. The officer (app actor gw-officer) stands
    // in the window behind the counter ledge (the front layer from the ledge down hides his lower half); the traveller (gw-trav) is a bust
    // in the foreground on the pier, over the front layer. The ferry and the gull are in the picture now, so no ferry / gull cut-outs.
    world:{mood:'day', stage:'clamp(200px, calc(55.4dvh - 214.5px), 300px)', plate:{src:'games/worlds/desk/art/desk-booth.webp?v=hf1', pos:'50% 50%', ready:true}, fit:{y:78}, front:{top:'44.8%'}, bed:{freq:320, q:.4, vol:.028, lfo:.12}, spots:['gull'],
      end:{over:true, spot:'horn', at:250}, layers:[], text:[   // the end: the booth stays behind the end card, the officer gone, the ferry's horn
      {key:'closed', cls:'gw-closed', id:'gw-closed', box:[56, 30, 24], ready:true}], sfx:{}, css:null}},   // the sign in the booth window turns to CLOSED at the end
  // Magic Words: the hall of doors (Magic Words v2, 2026-11-21, Trello GW6fI424): lavender walls, curtains, two lanterns, the wooden floor.
  // The app stands each word's painted door in the plate's box (its sill on the floor line); the wide corridor plate is the world at the sides.
  spell:{card:'art/posters/card-spell.webp?v=3', focus:'84%',
    palette:{sky:'#fcf2f8', sky2:'#efd5e5', glow:'#fff4d6', ground:'#eca560', ink:'#3a2342', accent:'#f0b232', accentInk:'#3a2342'},
    backdrop:{src:'games/worlds/spell/art/spell-corridor-wide.webp', position:'50% 50%', blur:30, veil:.5}, props:[],
    gw:{bg:'#efe8fb', surface:'#f5eee1', paper:'#fff3d2', ink:'#2a1d55', hue:'var(--clay-lavender-deep)', accent:'#f2b632', cta:'#f2b632', ctaInk:'#2a1d55'},
    world:{mood:'warm', moodVars:{'--m-gx':'50%', '--m-gy':'34%', '--m-gr':'58%'}, stage:'clamp(180px, calc(62dvh - 220px), 360px)', plate:{src:'games/worlds/spell/art/mw-hall.webp', ready:true}, bed:{freq:240, q:.5, vol:.022, lfo:.06}, layers:[], text:[], sfx:{}, css:null}},
  // Word Bingo: the bingo card on the kitchen table, cream, wood, red dots
  bingo:{card:'art/posters/card-bingo.webp?v=3', focus:'66%',
    palette:{sky:'#fbf7e6', sky2:'#ece4c6', glow:'#fffdf4', ground:'#d1a77d', ink:'#3a2c1c', accent:'#d9463a', accentInk:'#ffffff'},
    backdrop:{src:null, position:'66% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#f3f6d9', surface:'#e8c99a', paper:'#ffffff', ink:'#14332e', hue:'var(--cat-voc)', accent:'#FF6F5E', cta:'#14332e', ctaInk:'#ffffff'},
    world:{mood:'warm', moodVars:{'--m-gx':'70%', '--m-gy':'78%', '--m-gr':'45%'}, band:'small', stage:'clamp(150px, 26dvh, 260px)', plate:{src:'games/worlds/bingo/art/bingo-window.webp', ready:true}, layers:[
      {src:'games/worlds/bingo/art/bingo-dish.webp', cls:'gw-dish', box:[72, 84, 18], band:[74, 0, 18], sit:true, ready:true}], text:[], sfx:{}, css:null}},
  // Story Hunt: the open storybook and the magnifier in the library, sage and paper
  hunt:{card:'art/posters/card-hunt.webp?v=3', focus:'56%',
    palette:{sky:'#f0f4f0', sky2:'#d5ded7', glow:'#fffaef', ground:'#bfab86', ink:'#26332c', accent:'#bf513e', accentInk:'#ffffff'},
    backdrop:{src:null, position:'56% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#d6ebf7', surface:'#e8c48c', paper:'#fffaf0', ink:'#14332e', hue:'var(--cat-story)', accent:'#d8343f', cta:'#14332e', ctaInk:'#ffffff'},
    // the library shelf strip fills the band edge to edge (worlds art 2026-11-19); the lamp glow sits on its green lamp
    world:{mood:'lamp', moodVars:{'--m-gx':'92%', '--m-gy':'64%', '--m-gr':'30%'}, band:'small', stage:'clamp(96px, 18dvh, 180px)', plate:{src:'games/worlds/hunt/art/hunt-library.webp', ready:true}, bed:{freq:420, q:.6, vol:.022, lfo:.08}, spots:['clock'],
      strip:{src:'games/worlds/hunt/art/hunt-strip.webp', ratio:3, glow:[76, 56], ready:true},
      shot:{src:'games/worlds/hunt/art/hunt-library-wide.webp', ratio:1.5, glow:[76, 58], ready:true}, layers:[   // the opening and closing shots: the same room as the strip
      {src:'games/worlds/hunt/art/hunt-cardbox.webp', cls:'gw-cardbox', box:[8, 73, 16], band:[6, 0, 14], sit:true, ready:true},   // on the desk (mCqPUhyl B2)
      {src:'games/worlds/hunt/art/hunt-lens.webp', cls:'gw-lens', id:'gw-lens', box:[60, 73, 11], band:[58, 0, 8], sit:true, ready:true}], text:[], sfx:{}, css:null}},   // the lens on the floor by the window (clear of the lamp)
  // Say It Back: the echo between two voices, rose wall, teal
  echo:{card:'art/posters/card-echo.webp?v=3', focus:'68%',
    palette:{sky:'#fdf1ee', sky2:'#f2d0c9', glow:'#fff7f2', ground:'#5fb3a8', ink:'#2f2422', accent:'#0d8f87', accentInk:'#ffffff'},
    backdrop:{src:null, position:'68% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#f7d3d6', surface:'#f3e9e2', paper:'#fffaf0', ink:'#14332e', hue:'var(--cat-lis)', accent:'#e8402f', cta:'#14332e', ctaInk:'#ffffff'},
    world:{mood:'day', plate:{src:'games/worlds/echo/art/echo-studio.webp', ready:true}, front:{top:'74%'}, layers:[], text:[
      {key:'onair', cls:'gw-onair', id:'gw-onair', box:[56, 30, 36], ready:true}], sfx:{}, css:null}},
  // Listen & Type: headphones at the window over the harbour, soft grey-rose, orange headphones
  dictation:{card:'art/posters/card-dictation.webp?v=3', focus:'76%',
    palette:{sky:'#f8f3f1', sky2:'#e5dad5', glow:'#fffaf7', ground:'#b79984', ink:'#2f2a28', accent:'#cc6428', accentInk:'#ffffff'},
    backdrop:{src:null, position:'76% 50%', blur:30, veil:.56}, props:[],
    gw:{bg:'#fbd9d3', surface:'#f1e4d6', paper:'#fbf6e6', ink:'#14332e', hue:'var(--cat-lis)', accent:'#FFA53D', cta:'#14332e', ctaInk:'#ffffff'},
    world:{mood:'warm', plate:{src:'games/worlds/dictation/art/dictation-room.webp', ready:true}, front:{top:'80%'}, layers:[], text:[], sfx:{}, css:null}},
  // Trap Dash: the run to the striped barrier at the pier end, pale sky, sea
  trap:{card:'art/posters/card-trap.webp?v=3', focus:'60%',
    palette:{sky:'#f0f9f9', sky2:'#cbeceb', glow:'#ffffff', ground:'#86d8d8', ink:'#173638', accent:'#d4463a', accentInk:'#ffffff'},
    backdrop:{src:null, position:'60% 50%', blur:30, veil:.54}, props:[],
    gw:{bg:'#eef8f8', surface:'#e3c595', paper:'#ffffff', ink:'#173638', hue:'var(--cat-gram)', accent:'#d4463a', cta:'#173638', ctaInk:'#ffffff'},
    world:{mood:'day', plate:{src:'games/worlds/trap/art/trap-pier.webp', ready:true}, bed:{freq:900, q:.3, vol:.026, lfo:.2}, spots:['gull'], layers:[
      {src:'games/worlds/trap/art/trap-barrier.webp', cls:'gw-barrier', box:[34, 62, 32], ready:true}], text:[], sfx:{}, css:null}}
};
// Captain, the town cat, hides in the worlds (Games 2.0 SPEC 5.8; 3D poses since 2026-11-26, the box tops moved down so his feet stay put): 2 spots per world in plate % [x, y, w] (box) and, for the small-band
// worlds, in band % (band, sitting on the band floor). Poses sit / sleep / sniff (games/cozy-chores/art/pt-captain-*.webp), 36-48 px tall.
(function(S){
  var C = {
    order:[{box:[35, 56.4, 11], pose:'sit'}, {box:[6, 9, 13], pose:'sleep'}],          // the 3D café: on the floor left of the counter spot; asleep on top of the door frame
    build:[{box:[0.5, 61.7, 11], pose:'sit'}, {box:[31, 42.6, 16], pose:'sleep'}],        // on the blue crates; asleep on the window sill
    echo:[{box:[74, 68.9, 17], pose:'sleep'}, {box:[44, 74.5, 10], pose:'sit'}],          // asleep on the desk; on the chair back
    bingo:[{box:[6, 72.2, 11], band:[8, 0, 9], pose:'sit'}, {box:[60, 76.3, 16], band:[46, 0, 14], pose:'sleep'}],
    cross:[{box:[60, 72.2, 11], band:[62, 0, 9], pose:'sit'}, {box:[40, 78.3, 16], band:[40, 0, 14], pose:'sleep'}]
  };
  for(var k in C) if(S && S[k] && S[k].world) S[k].world.captain = C[k];
})(window.THEATRE_SKINS);
