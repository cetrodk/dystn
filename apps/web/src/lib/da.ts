const MAX_PLAYERS = 8;

/** Danish plural for "spiller" — "1 spiller", "2 spillere". */
export function pluralPlayers(n: number): string {
  return n === 1 ? "spiller" : "spillere";
}

export const da = {
  // App
  title: "Dystn",
  subtitle: "Sjove partyspil for venner og familie",

  // Landing
  createRoom: "Opret rum",
  pickGame: "Vælg et spil",
  howToPlay: "Sådan spiller du",
  startRoom: "Opret rum",
  back: "Tilbage",

  // Join
  enterCode: "Indtast rumkode",
  enterName: "Dit navn",
  join: "Deltag",
  invalidCode: "Ugyldig rumkode",
  roomNotFound: "Rummet blev ikke fundet",
  nameTaken: "Navnet er allerede taget",

  // Avatar editor
  avatar: {
    title: "Tilpas din avatar",
    shuffle: "Bland",
    color: "Farve",
    shape: "Form",
    eyes: "Øjne",
    mouth: "Mund",
    hat: "Hat",
    done: "Færdig",
  },

  // Lobby
  waitingForHost: "Venter på værten…",
  startGame: "Start spillet",
  playersJoined: "spillere tilsluttet",
  youreIn: "Du er med!",
  needMorePlayers: (min: number) => `Mindst ${min} ${pluralPlayers(min)}`,
  roomCode: "Rumkode",

  // Join-panel: rumkode + QR + link (lobby og rumkode-overlay under spil)
  joinPanel: {
    stepOne: "TRIN ÉT",
    joinTheRoom: "DELTAG I RUMMET",
    goTo: "Gå til",
    scanToJoin: "SCAN FOR AT DELTAGE",
    showPanelLabel: "Vis rumkode og QR",
    /** Ærlig linje under spil: serveren lukker ikke nye spillere ind midt i
     *  et spil — overlayet er til "hvad var koden?" og gen-tilslutning. */
    midGameNote:
      "Nye spillere kan først komme ind, når spillet er slut. Er du røget ud, kan du scanne og komme tilbage.",
  },

  // Game common
  timeLeft: "Tid tilbage",
  round: "Runde",
  of: "af",
  submit: "Send",
  nextRound: "Næste runde",
  scores: "Point",
  gameOver: "Spillet er slut!",
  playAgain: "Spil igen",
  backToLobby: "Tilbage til rummet",
  yourAnswer: "Dit svar",
  lookAtScreen: "Se op på skærmen!",
  waiting: "Venter på andre…",
  editAnswer: "Redigér svar",
  changeGame: "Skift spil",
  chooseNewGame: "Vælg nyt spil",
  noGameSelected: "Værten vælger et spil…",

  // Host lines
  host: {
    letsSeePre: "Lad os se, hvad I har fundet på…",
    andTheWinnerIs: "Og vinderen er…",
    closeOne: "Uha, det var tæt!",
    unanimous: "Enstemmigt! Ingen tvivl!",
    noVotes: "Ingen stemmer? Hårdt.",
    roundIntro: (n: number, total: number) => `Runde ${n} af ${total} — gør jer klar!`,
    nextUp: "Næste svar…",
  },

  // Connection
  connectionLost: "Forbindelse mistet — genopretter…",

  // Host disconnect
  hostDisconnected: "Værten er midlertidigt frakoblet",
  waitingForHostReturn: "Venter på at værten vender tilbage…",
  leaveGame: "Forlad spil",
  roomClosed: "Spillet er lukket",
  hostLeft: "Værten har forladt spillet",
  unknownPhaseTitle: "Øjeblik…",
  unknownPhaseHint:
    "Spillet er i en fase, din app ikke kender. Genindlæs siden — så er du med igen.",
  reloadPage: "Genindlæs",
  notHostOfRoom: "Du er ikke vært for dette rum",
  notHostOfRoomHint:
    "Rumkoden er allerede i brug af en anden vært, eller din værtsnøgle passer ikke længere. Opret et nyt rum for at fortsætte.",
  returnToRoom: "Vend tilbage til dit rum",
  createNewRoom: "Opret nyt rum",
  leaveRoomConfirm: "Du er vært — vil du virkelig forlade rummet?",
  stayHere: "Bliv her",
  leaveAnyway: "Forlad",

  // Games
  blitz: {
    name: "Blitz",
    description: "Skriv sjove svar — stem på det bedste!",
    howToPlay: "Alle får det samme spørgsmål og skriver et sjovt svar. Derefter stemmer alle på det bedste svar — undtagen dit eget!",
    minPlayers: 3,
    expects: `3–${MAX_PLAYERS} spillere • 3 runder • Tekst`,
    writeAnswer: "Skriv dit svar",
    prompt: "Spørgsmål",
    voteForBest: "Stem på det bedste svar",
    voteNowOnPhone: "Stem nu på jeres telefoner!",
    lookAtScreenForAnswers: "Se op — alle svarene står på skærmen!",
    resultsAreIn: "Stemmerne er talt op…",
    winner: "Vinder",
    tieLabel: "Det er uafgjort mellem",
    quiplash: "QUIPLASH!",
  },

  fusk: {
    name: "Fusk",
    description: "Find det rigtige svar blandt løgnene",
    howToPlay: "Du får et spørgsmål med et hul — skriv et falsk svar, der lyder ægte. Gæt derefter det rigtige svar blandt alle løgnene. Du scorer point for at narre de andre!",
    minPlayers: 3,
    expects: `3–${MAX_PLAYERS} spillere • 3 runder • Tekst`,
    writeFake: "Skriv et falsk svar",
    guessReal: "Gæt det rigtige svar",
    theRealAnswer: "Det rigtige svar",
    youFooled: "Du narrede",
    players: "spillere",
    fooledBy: "narret af",
    noOneGuessed: "Ingen gættede rigtigt!",
    yourFake: "Dit svar",
    correctGuess: "Gættede rigtigt!",
    wroteThis: "skrev dette",
  },

  scrawl: {
    name: "Scrawl",
    description: "Tegn på din telefon — andre gætter!",
    howToPlay: "Alle tegner et hemmeligt ord på telefonen. Derefter gætter de andre, hvad det forestiller — skriv et falsk gæt for at narre! Stem til sidst på det rigtige ord.",
    minPlayers: 3,
    expects: `3–${MAX_PLAYERS} spillere • 1 runde • Tegning + tekst`,
    draw: "Tegn!",
    guess: "Skriv dit gæt",
    theWordWas: "Ordet var:",
    clear: "Ryd",
    undo: "Fortryd",
    youAreTheArtist: "Du er kunstneren!",
    watchThemGuess: "Se de andre gætte på skærmen",
    whatIsBeingDrawn: "Hvad bliver der tegnet?",
    drawing: "Tegning",
    artistBonus: "Kunstnerbonus!",
    nextDrawing: "Næste tegning",
    yourGuess: "Dit gæt",
    guessReal: "Gæt det rigtige ord",
    artistWaiting: "De andre stemmer nu — vent her",
    drawingSecretWords: "Alle tegner deres hemmelige ord…",
    difficulty: "Sværhedsgrad",
    difficultyLevels: ["Let", "Medium", "Svær"] as readonly string[],
    difficultyDescriptions: [
      "Enkle ting (hest, hus, sol)",
      "Scener (en kat der sover i solen)",
      "Absurde situationer (en vampyr der er vegetar)",
    ] as readonly string[],
  },

  morph: {
    name: "Morph",
    description: "Skriv, tegn, gæt — se hvad der sker!",
    howToPlay: "Skriv en sjov sætning. Den næste tegner den, den næste gætter tegningen, den næste tegner gættet… Til sidst afsløres hele kæden — og du ser, hvor galt det gik!",
    minPlayers: 3,
    expects: `3–${MAX_PLAYERS} spillere • 1 runde • Tegning + tekst`,
    writePrompt: "Skriv en sjov sætning",
    writePlaceholder: "Fx: En hest, der læser avisen…",
    drawThis: "Tegn dette:",
    guessThis: "Hvad forestiller tegningen?",
    everyoneIsWriting: "Alle skriver en sætning…",
    everyoneIsDrawing: "Alle tegner…",
    everyoneIsGuessing: "Alle gætter…",
    chain: "Kæde",
    of: "af",
    nextStep: "Næste",
    nextChain: "Næste kæde",
    original: "Original",
    matchBonus: "Det matchede originalen!",
  },

  surge: {
    name: "Surge",
    description: "Sandt eller falsk? Kap om at nå målet!",
    howToPlay: "Et udsagn vises på skærmen — flyt dig til SANDT eller FALSK. Se i realtid, hvad de andre gør, og skift side for at narre dem. Men pas på: det tager tid at skifte, og bliver du fanget midt imellem, tæller det ikke! Rigtigt svar = ét skridt fremad, forkert svar = ét skridt tilbage. Først i mål vinder!",
    minPlayers: 2,
    expects: `2–${MAX_PLAYERS} spillere • Runder til første i mål • Videns-quiz`,
    sandt: "Sandt",
    falsk: "Falsk",
    transit: "Skifter side…",
    correct: "Rigtigt!",
    wrong: "Forkert!",
    noAnswer: "Du nåede ikke at vælge!",
    position: "Position",
    finish: "Mål",
    winner: "I mål!",
    sharedWin: "Delt sejr!",
    getReady: "Gør jer klar!",
    statement: "Påstand",
    lookAtScreenForChoices: "Se op — hvem skifter side?",
    difficulty: "Sværhedsgrad",
    difficultyLevels: ["Let", "Medium", "Svær"] as readonly string[],
    difficultyDescriptions: [
      "Simpelt (LEGO, dyr, popkultur)",
      "Almenviden (geografi, historie)",
      "Tricky myter og fakta",
    ] as readonly string[],
  },

  hunch: {
    name: "Hunch",
    description: "Giv et fingerpeg — andre gætter positionen!",
    howToPlay: "En spiller ser en hemmelig position på et spektrum og giver et fingerpeg. Alle andre gætter positionen. Jo tættere på, jo flere point!",
    minPlayers: 2,
    expects: `2–${MAX_PLAYERS} spillere • Roterende runder • Tekst`,
    youAreClueGiver: "Du giver fingerpeget!",
    writeClue: "Skriv dit fingerpeg",
    cluePlaceholder: "Ét ord eller en kort sætning…",
    waitingForClue: "skriver et fingerpeg…",
    clueIs: "Fingerpeget er",
    placeGuess: "Placer dit gæt",
    submitGuess: "Send gæt",
    editGuess: "Redigér gæt",
    watchingGuesses: "Venter på de andres gæt…",
    thisRound: "Denne runde",
    guessHint: "Brug fingerpeget til at gætte positionen på skalaen",
    targetWas: "Positionen var",
    exact: "Præcist!",
    close: "Meget tæt!",
    near: "Næsten!",
    miss: "Ikke helt…",
    clueGiverBonus: "Fingerpeger-bonus",
    yourScore: "Dine point",
  },

  // External games
  externalGames: "Bonusspil",
  opensNewTab: "Åbner i nyt faneblad",
  pris: {
    name: "Pris-quiz",
    description: "Gæt prisen på brugte ting fra DBA",
  },

  // Licens / Dystn-pakken — prisen står KUN her og skal matche Stripe-produktet
  license: {
    price: "99 kr.",
    supportEmail: "help@dystn.app",
    tab: "Licens",
    packName: "Dystn-pakken",
    packCard: {
      title: "Dystn-pakken",
      subtitle: "4 spil mere · dit for evigt",
      cta: "Lås op",
    },
    modal: {
      title: "Få hele Dystn-pakken",
      pitch: "Fusk, Morph, Surge og Hunch — alle spil, ét engangskøb, dit for evigt.",
      priceLabel: "Engangskøb",
      qrHint: "Scan og betal på din telefon",
      linkLabel: "Eller åbn betalingssiden her",
      haveCode: "Har du en kode?",
      codePlaceholder: "XXXXXX-XXXXXX-XXXXXX-XXXXXX",
      redeem: "Indløs",
      redeeming: "Indløser…",
      remember: "Husk på denne enhed",
      saved: "Koden er gemt — den bruges automatisk, når du opretter et rum",
      support: "Brug for hjælp?",
    },
    errors: {
      invalid: "Koden blev ikke genkendt — tjek for tastefejl",
      rateLimited: "For mange forsøg — vent et halvt minut og prøv igen",
      denylisted: "Denne kode er spærret — kontakt help@dystn.app",
      roomNotFound: "Rumkoden findes ikke — tjek de 4 bogstaver på skærmen",
      badFormat: "En kode har 24 tegn (XXXXXX-XXXXXX-XXXXXX-XXXXXX)",
      network: "Kunne ikke nå serveren — prøv igen",
    },
    tak: {
      title: "Tak for købet!",
      yourCode: "Din kode",
      copy: "Kopiér",
      copied: "Kopieret!",
      savedHere: "Koden er gemt på denne enhed",
      forget: "Glem igen",
      otherScreen:
        "Hoster du festen fra en anden skærm (TV/laptop)? Indtast koden dér, eller scan denne QR.",
      roomCodeLabel: "Har du et rum åbent? Indtast rumkoden fra skærmen:",
      roomCodePlaceholder: "ABCD",
      unlock: "Lås op i rummet",
      unlocked: "Pakken er låst op i rummet — kig på skærmen!",
      backToRoom: "Tilbage til dit rum",
      backToStart: "Til forsiden",
      mailHint: "Koden er også sendt til din e-mail.",
      pending: "Behandles — vent et øjeblik…",
      pendingTimeout: "Betalingen lader vente på sig. Skriv til os, så hjælper vi:",
      notCompleted: "Betalingen blev ikke gennemført.",
      buyAgain: "Prøv igen",
      errorTitle: "Noget gik galt",
      errorBody: "Vi kunne ikke hente din kode. Skriv til os med referencen nedenfor, så hjælper vi med det samme.",
      reference: "Reference",
    },
    landing: {
      getAllGames: "Få alle spil",
    },
    settings: {
      status: "Status for dette rum",
      unlockedPacks: "Dystn-pakken er låst op",
      freeOnly: "Kun gratisspillene (Blitz + Scrawl)",
      rememberedCode: "Husket kode på denne enhed",
      noRememberedCode: "Ingen kode husket på denne enhed",
      forgetTitle: "Lånt enhed?",
      forget: "Glem licensen her",
      forgetHint: "Fjerner kun koden fra denne browser — rummet beholder sine oplåste spil.",
    },
  },

  // Om-/infoside (og midlertidig launch-gate)
  om: {
    pageTitle: "Om Dystn — partyspil på dansk",
    linkLabel: "Om Dystn & kontakt",
    heroTagline: "Partyspil på dansk",
    heroTitle: "Ét TV. Alles telefoner. Én vinder.",
    heroBody:
      "Dystn er danske partyspil til fester, familiehygge og firmaaftener. Én person viser spillet på et TV eller en computer — alle andre spiller med på deres telefon. Ingen apps, intet login.",
    playNow: "Spil nu",
    comingSoon: "Vi åbner snart",
    comingSoonBody:
      "Vi lægger sidste hånd på Dystn. Skriv til os, hvis du vil have besked, når vi åbner dørene.",
    code: {
      haveCode: "Jeg har en kode",
      hint: "Har du fået en kode af os? Indtast den her, så er du inde — og alle spil følger med.",
      submit: "Lås op og spil",
    },
    how: {
      title: "Sådan virker det",
      sub: "Fra sofa til dyst på under et minut",
      steps: [
        {
          title: "Opret et rum",
          body: "Værten åbner dystn.app på TV'et eller computeren og opretter et rum.",
        },
        {
          title: "Deltag på telefonen",
          body: "Alle scanner QR-koden eller taster den korte rumkode på deres telefon.",
        },
        {
          title: "Dyst!",
          body: "Skriv, tegn, bluf og stem — pointene tælles helt automatisk.",
        },
      ],
    },
    games: {
      title: "Spillene",
      sub: "Seks spil — flere på vej",
      free: "Gratis",
      inPack: "Dystn-pakken",
    },
    pricing: {
      title: "Pris",
      sub: "Kun værten betaler — aldrig spillerne",
      freeTitle: "Gratis",
      freePrice: "0 kr.",
      freeBody: "Blitz og Scrawl er gratis — altid. Ubegrænset antal rum og runder.",
      packBody:
        "Fusk, Morph, Surge og Hunch oveni. Ét engangskøb — dit for evigt, ingen abonnement.",
      packPriceSuffix: "engangskøb",
    },
    contact: {
      title: "Kontakt & firmaoplysninger",
      sub: "Hvem står bag?",
      runBy: "Dystn drives af",
      cvrLabel: "CVR",
      emailLabel: "E-mail",
      responseNote: "Vi svarer typisk inden for 1–2 hverdage.",
    },
    footer: "© 2026 Dystn",
    backToFront: "Til forsiden",
  },
} as const;
