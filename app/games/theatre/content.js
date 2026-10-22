/* Game Theatre content - SPANISH app side (the English app has its own content.js; theatre.js/.css are shared byte for byte).
   Posters from the games-expansion proposal 2026-10-22, section 03 table, in Spanish. Titles and taglines are in the language the
   learner is learning (a real film poster); the kicker above the title is the game's name in the UI language (the app
   passes gameDisplayName). Key art: one swappable WebP per poster at games/posters/<kind>.webp - drop the file in and
   set artReady:true (artWide = optional landscape crop for the blurred tablet/desktop sides). Until then the frame shows
   a gradient placeholder with the title's first letter set large. Palettes stay light (no dark posters).
   HUD/poster strings: {en, tr, fa, es}; Persian is informal (to). */
window.THEATRE_CONTENT = {
  side:'es', target:'es', quotes:['«', '»'],   // the poster's own language and its quote marks
  posters:{
    path:{
      title:{A1:'La cámara', A2:'El último barco', B1:'Setenta y dos horas', B2:'Testimonio', 'default':'Testimonio'},
      tagline:'Una cámara. Dos veranos.',
      art:'games/posters/path.webp', artReady:false,
      palette:{sky:'#fdf3e1', sky2:'#f4dcb8', glow:'#fff3d6', ground:'#8fcfcc', ink:'#1c3533', accent:'#c8352e', accentInk:'#ffffff'}
    },
    chores:{
      title:'Puertas abiertas',
      tagline:'Pequeñas tareas. Grandes corazones. Una calle.',
      art:'games/posters/chores.webp', artReady:false,
      palette:{sky:'#fff6d8', sky2:'#f7cf8f', glow:'#fffbe9', ground:'#e9a86a', ink:'#4a2a12', accent:'#d8343f', accentInk:'#ffffff'}
    },
    mystery:{
      title:'Expedientes del puerto',
      tagline:'Todos tienen una historia. Una de ellas no es verdad.',
      art:'games/posters/mystery.webp', artReady:false,
      palette:{sky:'#f3e6c9', sky2:'#dcc28e', glow:'#fbf3e0', ground:'#c9a66b', ink:'#2b2016', accent:'#b3261e', accentInk:'#ffffff'}
    },
    order:{
      title:'Hora punta en el café de Sam',
      tagline:'Cinco clientes. Una bandeja. Escucha bien.',
      art:'games/posters/order.webp', artReady:false,
      palette:{sky:'#fff1e6', sky2:'#ffd2b0', glow:'#fff8ef', ground:'#f19a6b', ink:'#3a1f12', accent:'#1f7a6d', accentInk:'#ffffff'}
    },
    desk:{
      title:'Llegadas',
      tagline:'Cada viajero tiene una historia. Compruébala.',
      art:'games/posters/desk.webp', artReady:false,
      palette:{sky:'#eef6ff', sky2:'#c4e1f6', glow:'#ffffff', ground:'#8dbbe8', ink:'#13304d', accent:'#e2533c', accentInk:'#ffffff'}
    },
    spell:{
      title:'Las puertas de las palabras',
      tagline:'Dila bien y la puerta se abre.',
      art:'games/posters/spell.webp', artReady:false,
      palette:{sky:'#f4f0ff', sky2:'#d8cbf8', glow:'#fff7d6', ground:'#a592ea', ink:'#2a1d55', accent:'#f2b632', accentInk:'#2a1d55'}
    }
  },
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
    artSoon:{en:'Poster art in production', tr:'Afiş çiziliyor', fa:'پوستر داره کشیده می‌شه', es:'Cartel en producción'}
  }
};
