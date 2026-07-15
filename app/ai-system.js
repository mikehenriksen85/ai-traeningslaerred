(function work4itAiSystemModule() {
  "use strict";

  const VERSION = "2.0.0";
  const HEALTH_SAFETY_NOTICE = "Ved smerter, skade eller usikkerhed bør du kontakte læge eller fysioterapeut.";
  const MAX_HISTORY_ITEMS = 20;
  const REQUEST_USAGE_KEY = "ai_request_usage_v1";

  const PROMPTS = Object.freeze({
    assistant: {
      purpose: "Funger som personlig træningscoach og app-assistent i Work4it.",
      instructions: [
        "Svar på samme sprog som brugeren (dansk eller engelsk).",
        "Brug profil, prioriterede mål, erfaring, træningsstil, udstyr, aktiv dag, aktivt program og historik som kontekst.",
        "Spørg kort ind, hvis kommandoen kan betyde flere forskellige handlinger.",
        "Vis altid 'Jeg foreslår at ændre følgende...' før profil- eller programdata ændres.",
        "Udfør kun muterende handlinger efter brugerens aktive godkendelse.",
        "Ændr aldrig konto, login, medlemskab eller betaling.",
        "Slet aldrig data og overskriv aldrig programmer uden tydelig brugeraccept.",
        "Foretag aldrig flere programændringer end brugeren udtrykkeligt har bedt om.",
        "Ved smerte, skade eller sygdom: giv sikre lavrisiko-alternativer, ingen diagnose, og anbefal læge eller fysioterapeut.",
        "Giv en kort bekræftelse og forklar højst én vigtig begrundelse."
      ]
    },
    programGenerator: {
      purpose: "Generér et realistisk træningspas eller en ugeplan.",
      instructions: [
        "Respektér træningsmål, erfaring, antal dage, fokusområder og valgt antal øvelser.",
        "Vægt målene efter prioritering: primært mål styrer mest, sekundært mål justerer struktur, tertiært mål giver mindre variation.",
        "Brug kun øvelser fra Work4its katalog og undgå dubletter på samme dag.",
        "Hold styrke, cardio og træningssplit adskilt, medmindre brugeren aktivt vælger en kombination.",
        "Tilpas sæt, reps og pauser efter målet og undgå urealistisk volumen.",
        "Tag højde for prioriterede mål, træningsstil, udstyr, tid og brugerens begrænsninger.",
        "Vis programmet som et forslag og kræv godkendelse før oprettelse eller overskrivning.",
        "Overskriv ikke et eksisterende program uden en udtrykkelig generér/opret-kommando."
      ]
    },
    exerciseSuggestions: {
      purpose: "Foreslå sikre og relevante alternativer til en aktiv øvelse.",
      instructions: [
        "Bevar træningstype og primær muskelgruppe, medmindre brugeren beder om andet.",
        "Respektér udstyr, træningssted og ønsket sværhedsgrad.",
        "Ved begrænsninger skal alternativer være tydeligt mere passende end den oprindelige øvelse.",
        "Vis højst tre alternativer og lad brugeren vælge før udskiftning.",
        "Ved smerte, skade eller sygdom: giv ingen diagnose og anbefal faglig vurdering."
      ]
    },
    profileAnalysis: {
      purpose: "Forklar hvordan profilvalg påvirker fremtidige forslag.",
      instructions: [
        "Brug kun nødvendige profilfelter og vis ikke rå følsomme data unødvendigt.",
        "Behandl BMI, kalorier og kropsmål som estimater, ikke sundhedsfaglige konklusioner.",
        "Forklar ændringer kort og praktisk."
      ]
    },
    cardio: {
      purpose: "Opret og analysér cardio med realistisk tid, intensitet og variation.",
      instructions: [
        "Brug tid, distance, puls og historik, når de findes.",
        "Undgå at opfinde puls, distance eller kalorier.",
        "Tilpas belastning til mål og erfaring og markér kalorier som estimat."
      ]
    },
    calisthenics: {
      purpose: "Foreslå kropsvægtsøvelser og progressioner.",
      instructions: [
        "Brug kun øvelser markeret som kropsvægt eller uden maskiner.",
        "Tilpas progression/regression til erfaring og tilgængeligt udstyr.",
        "Kræv ikke avancerede færdigheder uden et passende lettere trin."
      ]
    },
    generalGuidance: {
      purpose: "Giv kort, praktisk og sikker vejledning om træning, kost og motivation.",
      instructions: [
        "Forklar vægttab, muskelopbygning, styrke, cardio, calisthenics, protein, kalorier, motivation og plateauer praktisk.",
        "Undgå ekstreme vægttabsråd, farlige programmer og træning gennem stærke smerter.",
        "Gør det tydeligt når kalorier, forbrænding og kropsmålinger er estimater."
      ]
    },
    screenshotImport: {
      purpose: "Omsæt et træningsscreenshot til et forslag, der skal godkendes.",
      instructions: [
        "Udled kun synlige øvelser, sæt, reps, vægt og pauser.",
        "Markér usikre felter og bed om bekræftelse.",
        "Gem eller overskriv intet før brugerens aktive godkendelse.",
        "Ignorér uvedkommende persondata i billedet."
      ]
    },
    animationSpecification: {
      purpose: "Opret en original, struktureret bevægelsesspecifikation til Work4its interne 3D-animationer.",
      instructions: [
        "Returnér kun schemaVersion 1 JSON til den angivne exerciseId.",
        "Brug 3-5 sekunders sømløst loop og Work4its faste front_three_quarter-kamera.",
        "Beskriv startposition, bevægelsesbane og slutposition ud fra øvelsesnavn, udstyr og bevægelse.",
        "Brug en neutral original figur og ingen eksterne source assets.",
        "Kopiér aldrig design, modeller, videoer eller animationer fra firmaer, apps eller hjemmesider.",
        "Output skal valideres og godkendes manuelt før aktivering."
      ]
    }
  });

  async function createExerciseAnimationSpecification(context) {
    const pipeline = window.Work4itExerciseAnimations;
    if (!pipeline?.generateSpecification) throw new Error("Animationspipeline er ikke klar");
    return pipeline.generateSpecification(context);
  }

  function safeJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function detectLanguage(input) {
    const value = String(input || "").toLowerCase();
    const danish = /[æøå]|\b(jeg|min|mit|træning|øvelse|sæt|vægt|dag|tilføj|fjern|erstat)\b/.test(value);
    const english = /\b(i|my|workout|exercise|sets?|weight|day|add|remove|replace|show)\b/.test(value);
    return english && !danish ? "en" : "da";
  }

  function summarizeHistory() {
    const entries = safeJson("training_analytics_history", []);
    if (!Array.isArray(entries)) return { sessionCount: 0, recentSessions: [] };
    const recent = entries.slice(-MAX_HISTORY_ITEMS);
    return {
      sessionCount: entries.length,
      lastSessionDate: recent.at(-1)?.date || null,
      recentSessions: recent.map(entry => ({
        date: entry.date || null,
        durationSeconds: Number(entry.durationSeconds || entry.totalSeconds) || 0,
        exerciseCount: Array.isArray(entry.exercises) ? entry.exercises.length : 0,
        totalVolume: Number(entry.totalVolume) || 0
      }))
    };
  }

  function activeProgramSummary() {
    const activeDayLabel = document.querySelector?.('#dayNavigation button[aria-current="page"]')?.textContent || "";
    const activeDayMatch = activeDayLabel.match(/\d+/);
    const exercises = [...document.querySelectorAll(".exercise")].map(block => {
      const name = block.querySelector(".exercise-name");
      return {
        name: name?.textContent?.trim() || "",
        muscle: name?.dataset?.muscle || "",
        exerciseType: block.dataset.exerciseType || "strength",
        setCount: block.querySelectorAll(".set-row").length,
        sets: [...block.querySelectorAll(".set-row")].map(row => ({
          reps: row.querySelector(".reps")?.value || row.querySelector(".reps")?.dataset?.targetReps || "",
          weightKg: Number(String(row.querySelector(".weight")?.value || "").replace(",", ".")) || null,
          pause: row.querySelector(".pause")?.value || ""
        }))
      };
    }).filter(exercise => exercise.name);
    return {
      title: document.getElementById("workoutTitle")?.textContent?.trim() || "",
      activeDay: activeDayMatch ? Number(activeDayMatch[0]) : 1,
      exercises
    };
  }

  function requestPeriodKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function requestUsage(membership = {}, consume = false, date = new Date()) {
    const cloudSnapshot = window.Work4itAIRequestCounter?.getSnapshot?.();
    if (cloudSnapshot && Number.isFinite(Number(cloudSnapshot.aiRequestLimit))) {
      return {
        allowed: cloudSnapshot.remaining > 0,
        limit: Number(cloudSnapshot.aiRequestLimit) || 0,
        used: Number(cloudSnapshot.aiRequestsUsed) || 0,
        remaining: Number(cloudSnapshot.remaining) || 0,
        period: cloudSnapshot.aiResetDate ? requestPeriodKey(new Date(cloudSnapshot.aiResetDate)) : "total",
        resetDate: cloudSnapshot.aiResetDate || null,
        source: cloudSnapshot.source || "counter"
      };
    }
    const limit = Math.max(0, Number(membership.aiRequestLimit) || 0);
    const period = requestPeriodKey(date);
    const stored = safeJson(REQUEST_USAGE_KEY, {});
    const usedBefore = stored.period === period ? Math.max(0, Number(stored.used) || 0) : 0;
    if (limit > 0 && usedBefore >= limit) return { allowed: false, limit, used: usedBefore, remaining: 0, period };
    const used = consume ? usedBefore + 1 : usedBefore;
    if (consume) {
      try { localStorage.setItem(REQUEST_USAGE_KEY, JSON.stringify({ period, used, updatedAt: new Date().toISOString() })); } catch {}
    }
    return { allowed: true, limit, used, remaining: limit > 0 ? Math.max(0, limit - used) : null, period };
  }

  function buildContext() {
    const profile = window.TrainingWizardStore?.getProfile?.() || {};
    const daily = window.TrainingWizardStore?.getDailyState?.() || {};
    const membership = window.Membership?.getMembership?.() || {};
    const usage = requestUsage(membership, false);
    return {
      version: VERSION,
      profile: {
        goal: profile.goal || "general_health",
        trainingGoals: window.TrainingWizardStore?.normalizeTrainingGoals?.(profile.trainingGoals, profile.goal || "general_health") || {
          primary: profile.goal || "general_health",
          secondary: "",
          tertiary: ""
        },
        priorityGoal: profile.personalGoal || "",
        experience: profile.experience || "intermediate",
        focusAreas: Array.isArray(profile.focusAreas) ? [...profile.focusAreas] : [],
        exercisePreference: profile.exercisePreference || "mixed",
        preferredTrainingStyle: ["gym", "calisthenics", "hybrid"].includes(profile.preferredTrainingStyle)
          ? profile.preferredTrainingStyle
          : "hybrid",
        trainingDaysPerWeek: Number(profile.trainingDaysPerWeek) || 3,
        preferredExerciseCount: Number(profile.preferredExerciseCount) || 5,
        availableEquipment: Array.isArray(profile.availableEquipment) ? [...profile.availableEquipment] : [],
        limitations: Array.isArray(profile.limitations) ? [...profile.limitations] : [],
        body: {
          age: Number(profile.age) || null,
          gender: profile.gender || "",
          heightCm: Number(profile.heightCm) || null,
          weightKg: Number(profile.weightKg) || null,
          bodyFat: Number(profile.bodyFat) || null,
          muscleMass: Number(profile.muscleMass) || null
        }
      },
      daily: {
        motivation: daily.dailyMotivation || daily.motivation || "",
        date: daily.dailyMotivationDate || ""
      },
      activeProgram: activeProgramSummary(),
      history: summarizeHistory(),
      membership: {
        type: membership.membershipType || "free",
        isPremium: membership.isPremium === true,
        requestLimit: Number(membership.aiRequestLimit) || 0,
        requestPeriod: membership.aiRequestPeriod || "",
        requestsUsed: usage.used,
        requestsRemaining: usage.remaining
      },
      capabilities: {
        externalModelConnected: false,
        screenshotImportEnabled: true,
        screenshotOcrEngine: "Tesseract.js 5.1.1 eng+dan",
        screenshotParser: "Work4it Structured Import Parser 1.0",
        dedicatedCalisthenicsGenerator: true,
        requestUsageEnforced: "client_demo",
        mutatingActionsRequireApproval: true,
        canModifyAfterApproval: [
          "profile",
          "trainingPreferences",
          "programs",
          "exercises",
          "sets",
          "reps",
          "weights",
          "pauses"
        ],
        forbiddenActions: [
          "accountSecurity",
          "loginMethod",
          "membershipPayment",
          "deleteWithoutConfirmation",
          "medicalDiagnosis"
        ]
      }
    };
  }

  function externalModelContext(context = buildContext(), options = {}) {
    const includeBody = options.includeBody === true;
    return {
      profile: {
        goal: context.profile.goal,
        trainingGoals: context.profile.trainingGoals,
        experience: context.profile.experience,
        focusAreas: context.profile.focusAreas,
        exercisePreference: context.profile.exercisePreference,
        preferredTrainingStyle: context.profile.preferredTrainingStyle,
        trainingDaysPerWeek: context.profile.trainingDaysPerWeek,
        preferredExerciseCount: context.profile.preferredExerciseCount,
        availableEquipment: context.profile.availableEquipment,
        limitations: context.profile.limitations,
        ...(includeBody ? { body: context.profile.body } : {})
      },
      daily: context.daily,
      activeProgram: context.activeProgram,
      history: {
        sessionCount: context.history.sessionCount,
        lastSessionDate: context.history.lastSessionDate
      }
    };
  }

  function guardInput(input) {
    const text = String(input || "").trim();
    const language = detectLanguage(text);
    const security = /(password|adgangskode|skift e-?mail|change e-?mail|login|log ind|log ud|google login|delete account|slet konto|payment|betaling|køb|buy|checkout|stripe|abonnementstype|membership type|premium-status|trial|prøveperiode)/i;
    const medical = /(ondt|smerte|skade|skadet|sygdom|diagnose|medicin|læge|fysioterapeut|pain|injur|medical|diagnos|medicine|doctor|physio)/i;
    if (security.test(text)) {
      return {
        allowed: false,
        type: "security",
        language,
        message: language === "en"
          ? "This cannot be changed through the AI assistant. Go to Profile → Account & security."
          : "Det kan ikke ændres via AI-assistenten. Gå til Profil → Konto & sikkerhed."
      };
    }
    if (medical.test(text)) {
      return {
        allowed: true,
        type: "health_caution",
        requiresSafetyNotice: true,
        language,
        message: language === "en"
          ? "I can suggest lower-risk training alternatives, but I cannot diagnose pain or injuries. Contact a doctor or physiotherapist if you have pain, an injury, or uncertainty."
          : HEALTH_SAFETY_NOTICE
      };
    }
    return { allowed: true, type: "training", language };
  }

  function practicalAdvice(input, context = buildContext()) {
    const text = String(input || "").toLowerCase();
    const profile = context.profile || {};
    const experience = { beginner: "nybegynderniveau", light_intermediate: "let øvet niveau", intermediate: "øvet niveau", experienced: "erfarent niveau" }[profile.experience] || "dit niveau";
    const goal = profile.trainingGoals?.primary || profile.goal || "general_health";
    const focus = profile.focusAreas?.length ? ` Prioritér især ${profile.focusAreas.join(", ").toLowerCase()}.` : "";
    const safety = /(smerte|ondt|skade|brækket|sygdom|pain|injur|broken)/i.test(text) ? `\n\n${HEALTH_SAFETY_NOTICE}` : "";
    if (/(taber jeg mig|vægttab|weight loss|lose weight)/i.test(text)) {
      return `Sigt efter et moderat kalorieunderskud, regelmæssig styrketræning og daglig bevægelse. Bevar proteinrige måltider, sov stabilt og vurder udviklingen over flere uger frem for at vælge ekstreme løsninger.${focus}${safety}`;
    }
    if (/(protein|proteiner|proteinindtag|how much protein)/i.test(text)) {
      return `Som praktisk tommelfingerregel fungerer ca. 1,6-2,2 g protein pr. kg kropsvægt ofte godt ved muskelopbygning eller vægttab. Fordel det over dagen og vælg et niveau du kan holde stabilt.${safety}`;
    }
    if (/(kalorie|kalorier|calorie|calories)/i.test(text)) {
      return `Brug kalorier som styringsværktøj, ikke som perfekt facit. Start med et realistisk estimat, følg vægt, energi og træningsperformance i 2-3 uger, og justér gradvist.${safety}`;
    }
    if (/(muskelmasse|muskelopbygning|muscle gain|build muscle)/i.test(text)) {
      return `Træn hver prioriteret muskelgruppe regelmæssigt, brug typisk 6-15 reps og øg gradvist reps eller belastning. Sørg for tilstrækkeligt protein, energi og restitution. Forslagene bør passe til ${experience}.${focus}${safety}`;
    }
    if (/(stærkere|styrke|stronger|strength)/i.test(text)) {
      return `Prioritér stabile basisøvelser, lavere reps, længere pauser og målbar progression. Hold teknikken ens fra uge til uge og undgå at øge belastningen på bekostning af kontrol.${focus}${safety}`;
    }
    if (/(kondition|cardio|conditioning|endurance)/i.test(text)) {
      return `Kombinér rolige pas med korte, kontrollerede intervaller. Start med en varighed du kan gentage stabilt, og øg tid eller intensitet gradvist, ikke begge dele samtidig.${safety}`;
    }
    if (/(calisthenics|kropsvægt|street workout|pull-up|muscle-up)/i.test(text)) {
      return `Byg calisthenics med tydelige progressioner: stabil teknik, kontrollerede reps og et lettere trin klar når formen falder. Prioritér basis som push-ups, rows, dips-varianter, core og pull-up progressioner.${safety}`;
    }
    if (/(motivation|motiveret|motivated|discipline)/i.test(text)) {
      return `Gør dagens opgave så konkret at den er nem at starte: én plan, få valg og et minimum du altid kan gennemføre. Stabilitet slår perfekte enkeltdage.${safety}`;
    }
    if (/(plateau|står stille|stagnation|stuck)/i.test(text)) {
      return `Hvis udviklingen står stille, så ændr én ting ad gangen: lidt flere reps, lidt mere vægt, bedre søvn, lavere volumen i en uge eller mere præcis teknik. Mål på trends, ikke én dårlig træning.${focus}${safety}`;
    }
    if (/(kombiner|kombinere|combine).*(styrke|strength).*(vægttab|weight loss)/i.test(text)) {
      return `Bevar 2-4 styrkepas om ugen, læg moderat cardio omkring dem og brug kosten til hovedparten af kalorieunderskuddet. Reducér volumen før du reducerer træningskvaliteten.${focus}${safety}`;
    }
    if (/(hvad bør jeg fokusere|ud fra min profil|what should i focus)/i.test(text)) {
      const label = { muscle_gain: "muskelopbygning", weight_loss: "vægttab", strength: "styrke", cardio: "cardio", general_health: "generel sundhed" }[goal] || goal;
      return `Dit primære fokus er ${label}. Brug en plan der matcher ${experience}, dine prioriterede mål og dit tilgængelige udstyr.${focus} Vælg en progression du kan gennemføre stabilt.${safety}`;
    }
    return "Jeg kan hjælpe med profil, mål, programmer, øvelser, sæt, reps, pauser, udstyr og tidsbegrænsninger. Beskriv det ønskede resultat, så giver jeg et konkret forslag uden at ændre noget før din godkendelse." + safety;
  }

  window.Work4itAISystem = {
    VERSION,
    PROMPTS,
    buildContext,
    externalModelContext,
    detectLanguage,
    guardInput,
    practicalAdvice,
    createExerciseAnimationSpecification,
    requestUsage,
    HEALTH_SAFETY_NOTICE
  };
})();
