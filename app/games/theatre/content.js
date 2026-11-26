/* Game Theatre content - SPANISH app side (the English app has its own content.js; theatre.js/.css are shared byte for byte).
   Posters from the games-expansion proposal 2026-10-22, section 03 table, in Spanish. Titles and taglines are in the language the
   learner is learning (a real film poster); the kicker above the title is the game's name in the UI language (the app
   passes gameDisplayName). Key art: one swappable WebP per poster at games/posters/<kind>.webp - drop the file in and
   set artReady:true (artWide = optional landscape crop for the blurred tablet/desktop sides). Until then there is
   no poster at all: the Theatre goes straight into the game (Farin: "nothing low designed"). Palettes stay light.
   HUD/poster strings: {en, tr, fa, es}; Persian is informal (to). */
window.THEATRE_CONTENT = {
  side:'es', target:'es', quotes:['«', '»'],   // the poster's own language and its quote marks
  posters:{
    path:{
      // Your Call v1 (live): one summer in Cudillero at every level. Your Call v2 swaps in its own titles when it ships
      // (La cámara A1 / El último barco A2 / Setenta y dos horas B1 / Testimonio B2, «Una cámara. Dos veranos.»).
      title:'Un verano en Cudillero',
      tagline:'Un pueblo nuevo. Una decisión cada vez.',
      art:'games/posters/path.webp', artReady:false,
      palette:{sky:'#fdf3e1', sky2:'#f4dcb8', glow:'#fff3d6', ground:'#8fcfcc', ink:'#1c3533', accent:'#c8352e', accentInk:'#ffffff'}
    },
    chores:{
      title:'Puertas abiertas',
      tagline:'Pequeñas tareas. Grandes corazones. Una calle.',
      art:'games/posters/chores.webp', artReady:false, full:'games/posters/chores-full.webp',
      palette:{sky:'#fff6d8', sky2:'#f7cf8f', glow:'#fffbe9', ground:'#e9a86a', ink:'#4a2a12', accent:'#d8343f', accentInk:'#ffffff'}
    },
    mystery:{
      title:'Expedientes del puerto',
      tagline:'Todos tienen una historia. Una de ellas no es verdad.',
      art:'games/posters/mystery.webp', artReady:false, full:'games/posters/mystery-full.webp',
      palette:{sky:'#f3e6c9', sky2:'#dcc28e', glow:'#fbf3e0', ground:'#c9a66b', ink:'#2b2016', accent:'#b3261e', accentInk:'#ffffff'}
    },
    order:{
      title:'Hora punta en el bar de Nacho',   // worlds SPEC 16: Harbour Files ES canon (el bar de Nacho)
      tagline:'Cinco clientes. Una bandeja. Escucha bien.',
      art:'games/posters/order-3d.webp', artReady:true, full:'games/posters/order-full.webp'   // the 4:5 key art (3D Sam with a cup and cake, Higgsfield / farin-e9 2026-11-25; first 2026-11-16; Games 2.0 SPEC 5.1: shown whole), with the palette from skins.js
    },
    desk:{
      title:'Llegadas',
      tagline:'Cada viajero tiene una historia. Compruébala.',
      art:'games/posters/desk-3d.webp', artReady:true, full:'games/posters/desk-full.webp' /* the 3D key art (Higgsfield, farin-e9, 2026-11-26) */   // until this portrait key art lands: the card poster + the palette from skins.js
    },
    radio:{
      // Mini Radio (spec mini-radio-2026-10-21.md 5.3): key art from the poster agent (GW74YH0q queue)
      title:'Mini Radio',
      tagline:'Sintoniza. Atrapa la historia.',
      art:'games/posters/radio-3d.webp', artReady:true, full:'games/posters/radio-full.webp' /* 3D key art (Higgsfield, farin-e9, 2026-11-26) */,
      palette:{sky:'#ffe1ef', sky2:'#ffd0e2', glow:'#fff3d2', ground:'#FF8FB3', ink:'#14332e', accent:'#FF6F5E', accentInk:'#ffffff'}
    },
    spell:{
      title:'Las puertas de las palabras',
      tagline:'Escríbela bien y la puerta se abre.',
      art:'games/posters/spell-3d.webp', artReady:true, full:'games/posters/spell-full.webp' /* 3D key art (Higgsfield, farin-e9, 2026-11-26) */   // the 4:5 key art (worlds art 2026-11-19), wired with Magic Words v2 (2026-11-21)
    },
    // quick games (2026-11-14): the poster is the live roadmap card art and its palette (skins.js), or the game's own 4:5 key art once it
    // passes (2026-11-16: Order Up!, Word Bingo, Say It Back; Mini Cross and Build It wait for fixed posters); titles + taglines from the
    // worlds SPEC section 16 (farin-gamification)
    match:{title:'La mesa de cartas', tagline:'Gira dos. Encuentra la pareja. El ferri ya casi llega.', art:'games/posters/match-3d.webp', artReady:true, full:'games/posters/match-full.webp' /* 3D key art (Higgsfield, farin-e9, 2026-11-26) */},
    build:{title:'El taller de palabras', tagline:'Bloque a bloque, la frase se levanta.', art:'games/posters/build-3d.webp', artReady:true, full:'games/posters/build-full.webp' /* 3D key art (Higgsfield, farin-e9, 2026-11-26) */},   // the 4:5 key art (worlds art 2026-11-19)
    cross:{title:'El crucigrama de la mañana', tagline:'Un café, un lápiz y las palabras que ya sabes.', art:'games/posters/cross-3d.webp', artReady:true, full:'games/posters/cross-full.webp' /* 3D key art (Higgsfield, farin-e9, 2026-11-26) */},
    bingo:{title:'Bingo en la ventana', tagline:'Nueve palabras. Un cartón al sol. Escucha la tuya.', art:'games/posters/bingo-3d.webp', artReady:true, full:'games/posters/bingo-full.webp' /* 3D key art (Higgsfield, farin-e9, 2026-11-26) */},
    hunt:{title:'La caza de palabras', tagline:'En algún lugar de tu historia se esconden las palabras.', art:'games/posters/hunt-3d.webp', artReady:true, full:'games/posters/hunt-full.webp' /* 3D key art (Higgsfield, farin-e9, 2026-11-26) */},
    echo:{title:'En antena', tagline:'Escucha. Repite. Oye tu eco.', art:'games/posters/echo-3d.webp', artReady:true, full:'games/posters/echo-full.webp' /* 3D key art (Higgsfield, farin-e9, 2026-11-26) */},
    dictation:{title:'Junto a la ventana', tagline:'Escucha bien. Escribe lo que oyes.', art:'games/posters/dictation-3d.webp', artReady:true, full:'games/posters/dictation-full.webp' /* 3D key art (Higgsfield, farin-e9, 2026-11-26) */},
    trap:{title:'Carrera en el muelle', tagline:'Elige rápido. Salta limpio.', art:'games/posters/trap-3d.webp', artReady:true, full:'games/posters/trap-full.webp' /* 3D key art (Higgsfield, farin-e9, 2026-11-26) */}
  },
  // live text on the world art, in the language being learned (World Kit text layers with a key; never mirrored)
  worldText:{onair:'EN ANTENA', closed:'CERRADO'},   // closed: Passport Desk's window sign at the end
  strings:{
    play:{en:'Play', tr:'Oyna', fa:'بازی کن', es:'Jugar'},
    'continue':{en:'Continue', tr:'Devam et', fa:'ادامه بده', es:'Continuar'},
    close:{en:'Close the game', tr:'Oyunu kapat', fa:'بازی رو ببند', es:'Cerrar el juego'},
    sound:{en:'Sound', tr:'Ses', fa:'صدا', es:'Sonido'},
    episodes:{en:'Chapters', tr:'Bölümler', fa:'فصل‌ها', es:'Capítulos'},
    starring:{en:'starring {name}', tr:'başrolde {name}', fa:'با بازی {name}', es:'protagonizada por {name}'},
    starringYou:{en:'starring {you}', tr:'başrolde {you}', fa:'با بازی {you}', es:'protagonizada por {you}'},
    you:{en:'you', tr:'sen', fa:'تو', es:'ti'},
    level:{en:'Level {level}', tr:'Seviye {level}', fa:'سطح {level}', es:'Nivel {level}'},
    artSoon:{en:'Poster art in production', tr:'Afiş çiziliyor', fa:'پوستر داره کشیده می‌شه', es:'Cartel en producción'},
    // the leave sheet while a quick game's round is in progress (the card stays open on the roadmap, so this is true)
    leaveQ:{en:'Leave the game? You can play it again any time.', tr:'Oyundan çıkıyor musun? İstediğin zaman yeniden oynayabilirsin.', fa:'از بازی می‌ری؟ هر وقت بخوای می‌تونی دوباره بازیش کنی.', es:'¿Sales del juego? Puedes volver a jugarlo cuando quieras.'},
    stay:{en:'Keep playing', tr:'Oynamaya devam et', fa:'بازی رو ادامه بده', es:'Seguir jugando'},
    leave:{en:'Leave', tr:'Çık', fa:'خروج', es:'Salir'},
    // Games 2.0 Phase 1 step 4 (2026-11-17): the Brave switch (SPEC 5.5), the boss beat (5.7), Captain sightings (5.8)
    normal:{en:'Normal', tr:'Normal', fa:'عادی', es:'Normal'},
    brave:{en:'Brave', tr:'Cesur', fa:'شجاع', es:'Valiente'},
    braveHint:{en:'Brave: fewer helping hands.', tr:'Cesur: daha az yardım.', fa:'شجاع: کمک کمتر.', es:'Valiente: menos ayudas.'},
    lastOne:{en:'Last one!', tr:'Son tur!', fa:'آخریشه!', es:'¡La última!'},
    captainHere:{en:'Captain was here.', tr:'Kaptan buradaydı.', fa:'کاپیتان اینجا بود.', es:'El Capitán estuvo aquí.'},
    captainLabel:{en:'A cat is hiding here', tr:'Burada bir kedi saklanıyor', fa:'یه گربه اینجا قایم شده', es:'Aquí se esconde un gato'},
    hear:{en:'Hear this line', tr:'Bu satırı dinle', fa:'این جمله رو گوش کن', es:'Escucha esta frase'}
  }
};
