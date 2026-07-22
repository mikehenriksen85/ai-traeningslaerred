(function () {
  const help = {
    title: "Hjælp / Om Work4it",
    logoAlt: "Work4it",
    introStrong: "Work4it er din AI-træningsplatform til smartere træning.",
    intro: "Planlæg, registrér og følg din udvikling ét sted. Work4it hjælper dig med at gøre træningen enkel, målrettet og lettere at fortsætte med.",
    valueTitle: "Hvorfor Work4it?",
    valuePoints: [
      "AI hjælper dig med at vælge næste gode skridt.",
      "Programmer tilpasses dine mål, erfaring og træningsstil.",
      "Cloud-synkronisering holder dine data samlet på tværs af enheder."
    ],
    features: [
      {
        icon: "coach",
        title: "AI der gør træning mere praktisk",
        text: "Få hjælp til programmer, øvelsesvalg, tilpasninger og hurtige ændringer uden at lede rundt i menuer."
      },
      {
        icon: "target",
        title: "Programmer efter dine mål",
        text: "Work4it understøtter styrketræning, cardio og calisthenics, så planen matcher det, du faktisk vil opnå."
      },
      {
        icon: "active",
        title: "Hurtig registrering",
        text: "Registrér sæt, reps, vægt, pauser, cardio og gennemførte sæt hurtigt, mens du træner."
      },
      {
        icon: "progress",
        title: "Historik og statistik",
        text: "Se volumen, estimeret 1RM, kropsmålinger, kalorier og udvikling over tid i et samlet overblik."
      },
      {
        icon: "cloud",
        title: "Cloud på tværs af enheder",
        text: "Når du er logget ind, kan dine programmer og profil følge dig mellem computer, tablet og mobil."
      },
      {
        icon: "import",
        title: "Import fra screenshots",
        text: "AI-import kan hjælpe med at omsætte billeder af træningsprogrammer til programmer i Work4it."
      }
    ],
    premium: {
      icon: "membership",
      title: "Premium giver mere fart på hverdagen",
      text: "Premium fremhæver de funktioner, der sparer tid: flere AI Requests, stærkere analyse, smartere planlægning og mere overblik."
    },
    feedback: {
      icon: "feedback",
      title: "Bygget med brugernes feedback",
      text: "Work4it udvikles løbende ud fra rigtige behov, forslag og fejlmeldinger fra brugerne."
    },
    closing: "Målet er enkelt: mindre friktion, mere overblik og træning der er lettere at holde fast i.",
    actions: {
      contact: "Kontakt",
      close: "Luk"
    }
  };

  window.Work4itContent = {
    defaultLocale: "da",
    locales: {
      da: { help },
      en: {
        help: {
          ...help,
          title: "Help / About Work4it"
        }
      }
    }
  };
})();
