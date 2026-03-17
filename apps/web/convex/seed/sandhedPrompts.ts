import { mutation } from "../_generated/server";

export const seedSandhedPrompts = mutation({
  handler: async (ctx) => {
    const prompts: Array<{ text: string; answer: "true" | "false"; category: string }> = [
      // Geografi
      { text: "Mount Everest er det højeste bjerg i verden", answer: "true", category: "geografi" },
      { text: "Sahara er verdens største ørken", answer: "false", category: "geografi" },
      { text: "Australien er både et land og et kontinent", answer: "true", category: "geografi" },
      { text: "Island ligger på den nordamerikanske plade", answer: "false", category: "geografi" },
      { text: "Amazonfloden er verdens længste flod", answer: "false", category: "geografi" },
      { text: "Rusland grænser op til 14 lande", answer: "true", category: "geografi" },
      { text: "Storebæltsbroen er længere end Øresundsbroen", answer: "true", category: "geografi" },
      { text: "Finland har over 180.000 søer", answer: "true", category: "geografi" },
      { text: "Grønland er verdens største ø", answer: "true", category: "geografi" },
      { text: "Tokyo er verdens mest befolkede by", answer: "true", category: "geografi" },
      { text: "Afrika har flere lande end Asien", answer: "true", category: "geografi" },
      { text: "Antarktis er ejet af Norge", answer: "false", category: "geografi" },

      // Historie
      { text: "Vikingerne opdagede Amerika før Columbus", answer: "true", category: "historie" },
      { text: "Den store kinesiske mur kan ses fra rummet med det blotte øje", answer: "false", category: "historie" },
      { text: "Kleopatra levede tættere på månelandingen end på pyramidernes opførelse", answer: "true", category: "historie" },
      { text: "Napoleon var usædvanligt kort for sin tid", answer: "false", category: "historie" },
      { text: "Oxford University er ældre end Azteker-imperiet", answer: "true", category: "historie" },
      { text: "Danmark har verdens ældste flag", answer: "true", category: "historie" },
      { text: "Titanic var det største skib nogensinde bygget da det sank", answer: "true", category: "historie" },
      { text: "Romerriget eksisterede i over 1000 år", answer: "true", category: "historie" },
      { text: "Anden verdenskrig startede i 1941", answer: "false", category: "historie" },
      { text: "De første Olympiske Lege blev holdt i Athen", answer: "false", category: "historie" },
      { text: "Albert Einstein dumpede matematik i skolen", answer: "false", category: "historie" },
      { text: "Den franske revolution begyndte i 1789", answer: "true", category: "historie" },

      // Videnskab
      { text: "Mennesker bruger kun 10% af deres hjerne", answer: "false", category: "videnskab" },
      { text: "Lys bevæger sig hurtigere end lyd", answer: "true", category: "videnskab" },
      { text: "Vand kan koge og fryse på samme tid", answer: "true", category: "videnskab" },
      { text: "Diamanter er lavet af kulstof", answer: "true", category: "videnskab" },
      { text: "Jordens kerne er varmere end solens overflade", answer: "true", category: "videnskab" },
      { text: "En teskefuld neutronskjerne vejer mere end Mount Everest", answer: "true", category: "videnskab" },
      { text: "Lyn slår aldrig ned samme sted to gange", answer: "false", category: "videnskab" },
      { text: "Bananer er radioaktive", answer: "true", category: "videnskab" },
      { text: "Der er flere stjerner i universet end sandkorn på Jorden", answer: "true", category: "videnskab" },
      { text: "Glas er en langsomt flydende væske", answer: "false", category: "videnskab" },
      { text: "Honning kan aldrig blive for gammelt at spise", answer: "true", category: "videnskab" },
      { text: "Mennesket har fem sanser", answer: "false", category: "videnskab" },

      // Popkultur
      { text: "ABBA var et dansk band", answer: "false", category: "popkultur" },
      { text: "Star Wars blev instrueret af Steven Spielberg", answer: "false", category: "popkultur" },
      { text: "Mario hed oprindeligt Jumpman", answer: "true", category: "popkultur" },
      { text: "Harry Potter-bøgerne er oversat til over 80 sprog", answer: "true", category: "popkultur" },
      { text: "The Beatles kom fra London", answer: "false", category: "popkultur" },
      { text: "Netflix startede som en DVD-udlejningsservice", answer: "true", category: "popkultur" },
      { text: "Pac-Man var inspireret af en pizza med et stykke taget", answer: "true", category: "popkultur" },
      { text: "Minecraft er det bedst sælgende videospil nogensinde", answer: "true", category: "popkultur" },
      { text: "James Bond drikker kun martini", answer: "false", category: "popkultur" },
      { text: "Walt Disney blev fyret fra en avis for manglende kreativitet", answer: "true", category: "popkultur" },
      { text: "Titanic vandt 11 Oscars", answer: "true", category: "popkultur" },
      { text: "LEGO er det mest producerede legetøj i verden", answer: "false", category: "popkultur" },

      // Danmark
      { text: "Danmark har over 7.000 øer", answer: "true", category: "danmark" },
      { text: "Christiania er et officielt uafhængigt land", answer: "false", category: "danmark" },
      { text: "Den lille havfrue-statuen er over 100 år gammel", answer: "true", category: "danmark" },
      { text: "Danmark er det ældste monarki i Europa", answer: "true", category: "danmark" },
      { text: "Carlsberg blev grundlagt i København", answer: "true", category: "danmark" },
      { text: "Dannebrog faldt angiveligt ned fra himlen i 1219", answer: "true", category: "danmark" },
      { text: "Hygge er et officielt ord i den engelske ordbog", answer: "true", category: "danmark" },
      { text: "Danmark er det mindste land i Skandinavien", answer: "true", category: "danmark" },
      { text: "Færøerne er en del af EU", answer: "false", category: "danmark" },
      { text: "H.C. Andersen var født i Odense", answer: "true", category: "danmark" },
      { text: "LEGO er en forkortelse af 'leg godt'", answer: "true", category: "danmark" },
      { text: "Danmark har verdens højeste skattetryk", answer: "false", category: "danmark" },

      // Sjove fakta
      { text: "En gruppe flamingoer kaldes en 'flamboyance'", answer: "true", category: "sjove-fakta" },
      { text: "En blæksprutte har tre hjerter", answer: "true", category: "sjove-fakta" },
      { text: "Krokodiller kan ikke stikke tungen ud", answer: "true", category: "sjove-fakta" },
      { text: "En snegl kan sove i tre år", answer: "true", category: "sjove-fakta" },
      { text: "Koalaer har fingeraftryk der ligner menneskers", answer: "true", category: "sjove-fakta" },
      { text: "Det tager 8 minutter for sollys at nå Jorden", answer: "true", category: "sjove-fakta" },
      { text: "Giraffer har samme antal halshvirvler som mennesker", answer: "true", category: "sjove-fakta" },
      { text: "Et år på Venus er kortere end en dag på Venus", answer: "true", category: "sjove-fakta" },
      { text: "Hummere er biologisk set udødelige", answer: "true", category: "sjove-fakta" },
      { text: "Guldfisk har en hukommelse på kun 3 sekunder", answer: "false", category: "sjove-fakta" },
      { text: "Elefanter er det eneste dyr der ikke kan hoppe", answer: "false", category: "sjove-fakta" },
      { text: "Der er flere mulige skak-spil end atomer i universet", answer: "true", category: "sjove-fakta" },
      { text: "Isbjørnes hud er sort under pelsen", answer: "true", category: "sjove-fakta" },
      { text: "En dag på Mars er næsten lige så lang som en dag på Jorden", answer: "true", category: "sjove-fakta" },
      { text: "Verdens korteste krig varede 38 minutter", answer: "true", category: "sjove-fakta" },
      { text: "Søheste er det eneste dyr hvor hannen føder", answer: "true", category: "sjove-fakta" },
    ];

    for (const p of prompts) {
      await ctx.db.insert("prompts", {
        gameType: "sandhed",
        text: p.text,
        answer: p.answer,
        category: p.category,
      });
    }
  },
});
