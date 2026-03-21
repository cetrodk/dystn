import { mutation } from "../_generated/server";

export const seedSandhedPrompts = mutation({
  handler: async (ctx) => {
    // Clear existing sandhed prompts
    const existing = await ctx.db
      .query("prompts")
      .withIndex("by_game", (q) => q.eq("gameType", "sandhed"))
      .collect();
    await Promise.all(existing.map((p) => ctx.db.delete(p._id)));

    // category = difficulty: "1" (let), "2" (medium), "3" (svær)
    const prompts: Array<{ text: string; answer: "true" | "false"; category: string }> = [
      // ── Difficulty 1: Let (simple, kid-friendly facts) ──
      { text: "Mount Everest er det højeste bjerg i verden", answer: "true", category: "1" },
      { text: "Sahara er verdens største varme ørken", answer: "true", category: "1" },
      { text: "Australien er både et land og et kontinent", answer: "true", category: "1" },
      { text: "Lys bevæger sig hurtigere end lyd", answer: "true", category: "1" },
      { text: "Diamanter er lavet af kulstof", answer: "true", category: "1" },
      { text: "Bananer er radioaktive", answer: "true", category: "1" },
      { text: "Honning kan aldrig blive for gammelt at spise", answer: "true", category: "1" },
      { text: "En blæksprutte har tre hjerter", answer: "true", category: "1" },
      { text: "Krokodiller kan ikke stikke tungen ud", answer: "true", category: "1" },
      { text: "En snegl kan sove i tre år", answer: "true", category: "1" },
      { text: "Giraffer har samme antal halshvirvler som mennesker", answer: "true", category: "1" },
      { text: "Isbjørnes hud er sort under pelsen", answer: "true", category: "1" },
      { text: "Guldfisk har en hukommelse på kun 3 sekunder", answer: "false", category: "1" },
      { text: "ABBA var et dansk band", answer: "false", category: "1" },
      { text: "The Beatles kom fra London", answer: "false", category: "1" },
      { text: "Star Wars blev instrueret af Steven Spielberg", answer: "false", category: "1" },
      { text: "Mario hed oprindeligt Jumpman", answer: "true", category: "1" },
      { text: "Minecraft er det bedst sælgende videospil nogensinde", answer: "true", category: "1" },
      { text: "Pac-Man var inspireret af en pizza med et stykke taget", answer: "true", category: "1" },
      { text: "Harry Potter-bøgerne er oversat til over 80 sprog", answer: "true", category: "1" },
      { text: "Netflix startede som en DVD-udlejningsservice", answer: "true", category: "1" },
      { text: "LEGO er en forkortelse af 'leg godt'", answer: "true", category: "1" },
      { text: "LEGO er verdens største legetøjsproducent", answer: "true", category: "1" },
      { text: "H.C. Andersen var født i Odense", answer: "true", category: "1" },
      { text: "Den lille havfrue-statuen er over 100 år gammel", answer: "true", category: "1" },
      { text: "Danmark har over 400 navngivne øer", answer: "true", category: "1" },
      { text: "Carlsberg blev grundlagt i København", answer: "true", category: "1" },

      // ── Difficulty 2: Medium (requires some general knowledge) ──
      { text: "Vikingerne opdagede Amerika før Columbus", answer: "true", category: "2" },
      { text: "Den store kinesiske mur kan ses fra rummet med det blotte øje", answer: "false", category: "2" },
      { text: "Amazonfloden er verdens længste flod", answer: "false", category: "2" },
      { text: "Island ligger delvist på den nordamerikanske plade", answer: "true", category: "2" },
      { text: "Rusland grænser op til 14 lande", answer: "true", category: "2" },
      { text: "Storebæltsbroen er længere end Øresundsbroen", answer: "true", category: "2" },
      { text: "Finland har over 180.000 søer", answer: "true", category: "2" },
      { text: "Grønland er verdens største ø", answer: "true", category: "2" },
      { text: "Canada er det næststørste land i verden", answer: "true", category: "2" },
      { text: "Afrika har flere lande end Asien", answer: "true", category: "2" },
      { text: "Antarktis er ejet af Norge", answer: "false", category: "2" },
      { text: "Anden verdenskrig startede i 1941", answer: "false", category: "2" },
      { text: "De første moderne Olympiske Lege blev holdt i Athen", answer: "true", category: "2" },
      { text: "Den franske revolution begyndte i 1789", answer: "true", category: "2" },
      { text: "Titanic var det største skib nogensinde bygget da det sank", answer: "true", category: "2" },
      { text: "Romerriget eksisterede i over 1000 år", answer: "true", category: "2" },
      { text: "Danmark har verdens ældste flag", answer: "true", category: "2" },
      { text: "Danmark er det ældste monarki i Europa", answer: "true", category: "2" },
      { text: "Dannebrog faldt angiveligt ned fra himlen i 1219", answer: "true", category: "2" },
      { text: "Danmark er det mindste land i Skandinavien", answer: "true", category: "2" },
      { text: "Christiania er et officielt uafhængigt land", answer: "false", category: "2" },
      { text: "Færøerne er en del af EU", answer: "false", category: "2" },
      { text: "Hygge er et officielt ord i den engelske ordbog", answer: "true", category: "2" },
      { text: "Walt Disney blev fyret fra en avis for manglende kreativitet", answer: "true", category: "2" },
      { text: "Titanic vandt 11 Oscars", answer: "true", category: "2" },
      { text: "En gruppe flamingoer kaldes en 'flamboyance'", answer: "true", category: "2" },
      { text: "Koalaer har fingeraftryk der ligner menneskers", answer: "true", category: "2" },
      { text: "En dag på Mars er næsten lige så lang som en dag på Jorden", answer: "true", category: "2" },
      { text: "Verdens korteste krig varede 38 minutter", answer: "true", category: "2" },

      // ── Difficulty 3: Svær (counterintuitive, tricky, obscure) ──
      { text: "Kleopatra levede tættere på månelandingen end på pyramidernes opførelse", answer: "true", category: "3" },
      { text: "Napoleon var usædvanligt kort for sin tid", answer: "false", category: "3" },
      { text: "Oxford University er ældre end Azteker-imperiet", answer: "true", category: "3" },
      { text: "Albert Einstein dumpede matematik i skolen", answer: "false", category: "3" },
      { text: "Mennesker bruger kun 10% af deres hjerne", answer: "false", category: "3" },
      { text: "Vand kan koge og fryse på samme tid", answer: "true", category: "3" },
      { text: "Jordens kerne er varmere end solens overflade", answer: "true", category: "3" },
      { text: "En teskefuld neutronskjerne vejer mere end Mount Everest", answer: "true", category: "3" },
      { text: "Lyn slår aldrig ned samme sted to gange", answer: "false", category: "3" },
      { text: "Der er flere stjerner i universet end sandkorn på Jorden", answer: "true", category: "3" },
      { text: "Glas er en langsomt flydende væske", answer: "false", category: "3" },
      { text: "Mennesket har fem sanser", answer: "false", category: "3" },
      { text: "James Bond drikker kun martini", answer: "false", category: "3" },
      { text: "Et år på Venus er kortere end en dag på Venus", answer: "true", category: "3" },
      { text: "Hummere er biologisk set udødelige", answer: "false", category: "3" },
      { text: "Elefanter er det eneste dyr der ikke kan hoppe", answer: "false", category: "3" },
      { text: "Der er flere mulige skak-spil end atomer i universet", answer: "true", category: "3" },
      { text: "Søheste er det eneste dyr med en ægte yngelpung hos hannen", answer: "true", category: "3" },
      { text: "Det tager 8 minutter for sollys at nå Jorden", answer: "true", category: "3" },
      { text: "Danmark har verdens højeste skattetryk", answer: "false", category: "3" },
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
