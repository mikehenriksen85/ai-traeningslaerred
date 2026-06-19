(function work4itAiSystemModule() {
  "use strict";

  const VERSION = "1.0.0";
  const MAX_HISTORY_ITEMS = 20;

  const PROMPTS = Object.freeze({
    assistant: {
      purpose: "Fortolk en kommando og foreslå én konkret Work4it-handling.",
      instructions: [
        "Svar på samme sprog som brugeren (dansk eller engelsk).",
        "Brug mål, erfaring, fokusområder, aktiv dag og aktivt program som kontekst.",
        "Spørg kort ind, hvis kommandoen kan betyde flere forskellige handlinger.",
        "Ændr aldrig konto, login, medlemskab eller betaling.",
        "Foretag aldrig flere programændringer end brugeren udtrykkeligt har bedt om.",
        "Giv en kort bekræftelse og forklar højst én vigtig begrundelse."
      ]
    },
    programGenerator: {
      purpose: "Generér et realistisk træningspas eller en ugeplan.",
      instructions: [
        "Respektér træningsmål, erfaring, antal dage, fokusområder og valgt antal øvelser.",
        "Brug kun øvelser fra Work4its katalog og undgå dubletter på samme dag.",
        "Hold styrke, cardio og træningssplit adskilt, medmindre brugeren aktivt vælger en kombination.",
        "Tilpas sæt, reps og pauser efter målet og undgå urealistisk volumen.",
        "Overskriv ikke et eksisterende program uden en udtrykkelig generér/opret-kommando."
      ]
    },
    exerciseSuggestions: {
      purpose: "Foreslå sikre og relevante alternativer til en aktiv øvelse.",
      instructions: [
        "Bevar træningstype og primær muskelgruppe, medmindre brugeren beder om andet.",
        "Respektér udstyr, træningssted og ønsket sværhedsgrad.",
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
    screenshotImport: {
      purpose: "Omsæt et træningsscreenshot til et forslag, der skal godkendes.",
      instructions: [
        "Udled kun synlige øvelser, sæt, reps, vægt og pauser.",
        "Markér usikre felter og bed om bekræftelse.",
        "Gem eller overskriv intet før brugerens aktive godkendelse.",
        "Ignorér uvedkommende persondata i billedet."
      ]
    }
  });

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
        setCount: block.querySelectorAll(".set-row").length
      };
    }).filter(exercise => exercise.name);
    return {
      title: document.getElementById("workoutTitle")?.textContent?.trim() || "",
      activeDay: activeDayMatch ? Number(activeDayMatch[0]) : 1,
      exercises
    };
  }

  function buildContext() {
    const profile = window.TrainingWizardStore?.getProfile?.() || {};
    const daily = window.TrainingWizardStore?.getDailyState?.() || {};
    const membership = window.Membership?.getMembership?.() || {};
    return {
      version: VERSION,
      profile: {
        goal: profile.goal || "general_health",
        priorityGoal: profile.personalGoal || "",
        experience: profile.experience || "intermediate",
        focusAreas: Array.isArray(profile.focusAreas) ? [...profile.focusAreas] : [],
        exercisePreference: profile.exercisePreference || "mixed",
        trainingDaysPerWeek: Number(profile.trainingDaysPerWeek) || 3,
        preferredExerciseCount: Number(profile.preferredExerciseCount) || 5,
        availableEquipment: Array.isArray(profile.availableEquipment) ? [...profile.availableEquipment] : [],
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
        requestPeriod: membership.aiRequestPeriod || ""
      },
      capabilities: {
        externalModelConnected: false,
        screenshotImportEnabled: false,
        dedicatedCalisthenicsGenerator: false,
        requestUsageEnforced: false
      }
    };
  }

  function externalModelContext(context = buildContext(), options = {}) {
    const includeBody = options.includeBody === true;
    return {
      profile: {
        goal: context.profile.goal,
        experience: context.profile.experience,
        focusAreas: context.profile.focusAreas,
        exercisePreference: context.profile.exercisePreference,
        trainingDaysPerWeek: context.profile.trainingDaysPerWeek,
        preferredExerciseCount: context.profile.preferredExerciseCount,
        availableEquipment: context.profile.availableEquipment,
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
    const security = /(password|adgangskode|e-?mail|email|login|log ind|log ud|google login|delete account|slet konto|payment|betaling|membership|medlemskab|premium|trial|prøveperiode)/i;
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
        allowed: false,
        type: "health",
        language,
        message: language === "en"
          ? "I can adapt training preferences, but I cannot diagnose pain or injuries. Stop if the movement hurts and consider advice from a doctor or physiotherapist."
          : "Jeg kan tilpasse træningspræferencer, men ikke diagnosticere smerter eller skader. Stop hvis bevægelsen gør ondt, og overvej rådgivning fra læge eller fysioterapeut."
      };
    }
    return { allowed: true, type: "training", language };
  }

  window.Work4itAISystem = {
    VERSION,
    PROMPTS,
    buildContext,
    externalModelContext,
    detectLanguage,
    guardInput
  };
})();
