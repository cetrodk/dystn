import { MIN_PLAYERS, MAX_PLAYERS } from "../../convex/lib/gameConfig";

export const da = {
  // App
  title: "Festspil",
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

  // Lobby
  waitingForHost: "Venter på værten...",
  startGame: "Start Spil",
  playersJoined: "spillere tilsluttet",
  youreIn: "Du er med!",
  needMorePlayers: `Mindst ${MIN_PLAYERS} spiller(e)`,
  roomCode: "Rumkode",

  // Game common
  timeLeft: "Tid tilbage",
  round: "Runde",
  of: "af",
  submit: "Send",
  nextRound: "Næste runde",
  scores: "Point",
  gameOver: "Spillet er slut!",
  playAgain: "Spil igen",
  backToLobby: "Tilbage til lobbyen",
  yourAnswer: "Dit svar",
  lookAtScreen: "Se op på skærmen!",
  waiting: "Venter på andre...",

  // Connection
  connectionLost: "Forbindelse mistet — genopretter...",

  // Games
  duel: {
    name: "Duel",
    description: "Skriv sjove svar — stem på det bedste!",
    howToPlay: "Alle får det samme spørgsmål og skriver et sjovt svar. Derefter stemmer alle på det bedste svar — undtagen dit eget!",
    expects: `${MIN_PLAYERS}–${MAX_PLAYERS} spillere • 3 runder • Tekst`,
    writeAnswer: "Skriv dit svar",
    prompt: "Spørgsmål",
    voteForBest: "Stem på det bedste svar",
    winner: "Vinder",
    quiplash: "QUIPLASH!",
  },

  bluff: {
    name: "Bluff",
    description: "Find det rigtige svar blandt løgnene",
    howToPlay: "Du får et spørgsmål med et hul — skriv et falsk svar der lyder ægte. Gæt derefter det rigtige svar mellem alle løgnene. Du scorer point for at narre andre!",
    expects: `${MIN_PLAYERS}–${MAX_PLAYERS} spillere • 3 runder • Tekst`,
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

  tegn: {
    name: "Tegn & Gæt",
    description: "Tegn på din telefon — andre gætter!",
    howToPlay: "Alle tegner et hemmeligt ord på telefonen. Derefter gætter de andre hvad det forestiller — skriv falske gæt for at narre! Stem på det rigtige ord.",
    expects: `${MIN_PLAYERS}–${MAX_PLAYERS} spillere • 1 runde • Tegning + tekst`,
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
    drawingSecretWords: "Alle tegner deres hemmelige ord...",
  },

  telefon: {
    name: "Telefon",
    description: "Skriv, tegn, gæt — se hvad der sker!",
    howToPlay: "Skriv en sjov sætning. Den næste tegner den, den næste gætter tegningen, den næste tegner gættet... Til sidst afsløres hele kæden — og du ser hvor galt det gik!",
    expects: `${MIN_PLAYERS}–${MAX_PLAYERS} spillere • 1 runde • Tegning + tekst`,
    writePrompt: "Skriv en sjov sætning",
    writePlaceholder: "Fx: En hest der læser avisen...",
    drawThis: "Tegn dette:",
    guessThis: "Hvad forestiller tegningen?",
    everyoneIsWriting: "Alle skriver en sætning...",
    everyoneIsDrawing: "Alle tegner...",
    everyoneIsGuessing: "Alle gætter...",
    chain: "Kæde",
    of: "af",
    nextStep: "Næste",
    nextChain: "Næste kæde",
    original: "Original",
    matchBonus: "Det matchede originalen!",
  },

  // External games
  externalGames: "Bonusspil",
  opensNewTab: "Åbner i nyt faneblad",
  pris: {
    name: "Pris-quiz",
    description: "Gæt prisen på brugte ting fra DBA",
  },
} as const;
