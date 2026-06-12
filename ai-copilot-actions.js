(function aiCopilotActionsModule() {
  "use strict";

  const HISTORY_KEY = "ai_copilot_history";
  const MAX_HISTORY = 200;

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function numberValue(value) {
    const number = Number.parseFloat(String(value || "").replace(",", "."));
    return Number.isFinite(number) ? number : null;
  }

  function titleCase(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/(^|\s)\S/g, letter => letter.toUpperCase());
  }

  function parseFocusAreas(text) {
    const aliases = [
      ["Bryst", ["bryst"]],
      ["Skuldre", ["skulder", "skuldre"]],
      ["Arme", ["arm", "arme", "biceps", "triceps"]],
      ["Ben", ["ben", "lår", "baller"]],
      ["Core", ["core", "mave", "lænd", "stabilitet"]],
      ["Ryg", ["ryg"]]
    ];
    return aliases
      .filter(([, terms]) => terms.some(term => text.includes(term)))
      .map(([area]) => area);
  }

  function parse(command) {
    const text = normalize(command);
    if (!text) return null;

    if (/(adgangskode|password|e-?mail|email|login|log ind|log ud|google-login|google login|slet konto|betaling|betalings|medlemskab|prøveperiode|premium)/i.test(text)) {
      return {
        action: "blockedSecurity",
        message: "Det kan ikke ændres via AI Copilot. Gå til Profil → Konto & sikkerhed."
      };
    }

    if (/^(jeg vil )?(træne|have) mere ryg[.!]?$/i.test(text)) {
      return {
        action: "clarify",
        message: "Vil du tilføje ryg som fokusområde eller ændre dagens træning til ryg?"
      };
    }

    let match = text.match(/(?:skift|sæt|ændr|opdater)?\s*(?:mit\s+)?(?:træningsmål|mål)\s+(?:til\s+)?(muskelopbygning|muskelvækst|vægttab|styrke|generel sundhed)/i);
    if (match) {
      const goals = {
        muskelopbygning: "muscle_gain",
        muskelvækst: "muscle_gain",
        vægttab: "weight_loss",
        styrke: "strength",
        "generel sundhed": "general_health"
      };
      return { action: "updateTrainingPreference", field: "goal", value: goals[match[1]] };
    }

    match = text.match(/(?:sæt|skift|ændr|opdater)?\s*(?:mit\s+)?(?:niveau|erfaring)\s+(?:til\s+)?(nybegynder|let øvet|øvet|erfaren)/i);
    if (match) {
      const levels = {
        nybegynder: "beginner",
        "let øvet": "light_intermediate",
        øvet: "intermediate",
        erfaren: "experienced"
      };
      return { action: "updateTrainingPreference", field: "experience", value: levels[match[1]] };
    }

    match = text.match(/(?:jeg vil fokusere(?: mere)? på|tilføj som fokusområde|sæt mine fokusområder til)\s+(.+)/i);
    if (match) {
      const areas = parseFocusAreas(match[1]);
      return areas.length
        ? { action: "updateTrainingPreference", field: "focusAreas", value: areas, mode: "add" }
        : { action: "clarify", message: "Hvilke fokusområder vil du vælge: bryst, skuldre, arme, ben, core eller ryg?" };
    }

    match = text.match(/(?:jeg vil træne|sæt|ændr|opdater)?\s*(\d+)\s*(?:trænings)?dage(?:\s+om|\s+pr\.)?\s*ugen/i);
    if (match) {
      return { action: "updateTrainingPreference", field: "trainingDaysPerWeek", value: Number(match[1]) };
    }

    if (/(mere variation|ønsker variation|varierende øvelser)/i.test(text)) {
      return { action: "updateTrainingPreference", field: "exercisePreference", value: "variation" };
    }
    if (/(faste øvelser|samme øvelser)/i.test(text)) {
      return { action: "updateTrainingPreference", field: "exercisePreference", value: "consistent" };
    }
    if (/(lidt af begge|blanding af faste og variation|blandet variation)/i.test(text)) {
      return { action: "updateTrainingPreference", field: "exercisePreference", value: "mixed" };
    }

    match = text.match(/(?:helst have|foretrækker|sæt|vælg)?\s*(\d+)\s*øvelser(?:\s+pr\.?\s*træning)?/i);
    if (match) {
      return { action: "updateTrainingPreference", field: "preferredExerciseCount", value: Number(match[1]) };
    }

    match = text.match(/(?:sæt|skift|ændr|lav|opdater)?\s*(?:min\s+)?motivation(?:\s+i dag)?\s+(?:til\s+)?(lav|normal|høj)/i);
    if (match) {
      return {
        action: "updateTrainingPreference",
        field: "motivation",
        value: { lav: "low", normal: "normal", høj: "high" }[match[1]]
      };
    }

    match = text.match(/(?:sæt min vægt til|jeg vejer(?: nu)?|min vægt er|opdater min vægt til)\s*(\d+(?:[.,]\d+)?)\s*kg?/i);
    if (match) return { action: "updateProfile", field: "weightKg", value: numberValue(match[1]) };

    match = text.match(/(?:sæt min højde til|min højde er|opdater min højde til)\s*(\d+(?:[.,]\d+)?)\s*cm?/i);
    if (match) return { action: "updateProfile", field: "heightCm", value: numberValue(match[1]) };

    match = text.match(/(?:sæt min alder til|jeg er|min alder er)\s*(\d{1,3})\s*(?:år)?/i);
    if (match) return { action: "updateProfile", field: "age", value: Number(match[1]) };

    match = text.match(/(?:sæt|ændr|opdater)?\s*(?:mit\s+)?køn\s+(?:til\s+)?(mand|kvinde|ønsker ikke at oplyse)/i);
    if (match) {
      return {
        action: "updateProfile",
        field: "gender",
        value: { mand: "man", kvinde: "woman", "ønsker ikke at oplyse": "not_specified" }[match[1]]
      };
    }

    match = text.match(/(?:min fedtprocent er|sæt min fedtprocent til|opdater min fedtprocent til)\s*(\d+(?:[.,]\d+)?)\s*%?/i);
    if (match) return { action: "updateProfile", field: "bodyFat", value: numberValue(match[1]) };

    match = text.match(/(?:min muskelmasse er|sæt min muskelmasse til|opdater min muskelmasse til)\s*(\d+(?:[.,]\d+)?)\s*kg?/i);
    if (match) return { action: "updateProfile", field: "muscleMass", value: numberValue(match[1]) };

    match = text.match(/^(?:mit personlige mål er|mit mål er)\s+(.+)$/i);
    if (match) return { action: "updateProfile", field: "personalGoal", value: match[1].trim() };

    match = text.match(/^vis\s+dag\s+(\d+)$/i);
    if (match) return { action: "switchDay", day: Number(match[1]) };

    match = text.match(/^flyt\s+(.+?)\s+til\s+dag\s+(\d+)$/i);
    if (match) return { action: "moveExercise", exerciseName: match[1].replace(/^øvelse\s+/i, "").trim(), day: Number(match[2]) };

    match = text.match(/^tilføj\s+(?!mere\s+)(.+)$/i);
    if (match) return { action: "addExercise", exerciseName: titleCase(match[1]) };

    match = text.match(/^fjern\s+(.+)$/i);
    if (match) return { action: "removeExercise", exerciseName: match[1].trim() };

    match = text.match(/^erstat\s+(.+?)\s+med\s+(.+)$/i);
    if (match) {
      return {
        action: "replaceExercise",
        exerciseName: match[1].trim(),
        replacementName: titleCase(match[2])
      };
    }

    match = text.match(/^sæt\s+(.+?)\s+til\s+(\d+)\s+sæt(?:\s+af\s+(\d+)\s+reps?)?(?:\s+(?:med|og)\s+(\d+(?:[.,]\d+)?)\s*kg)?$/i);
    if (match) {
      return {
        action: "updateExercise",
        exerciseName: match[1].trim(),
        sets: Number(match[2]),
        reps: match[3] ? Number(match[3]) : null,
        weightKg: match[4] ? numberValue(match[4]) : null
      };
    }

    match = text.match(/^sæt\s+(.+?)\s+til\s+(\d+(?:[.,]\d+)?)\s*kg$/i);
    if (match) {
      return {
        action: "updateExercise",
        exerciseName: match[1].trim(),
        weightKg: numberValue(match[2])
      };
    }

    match = text.match(/^sæt\s+(.+?)\s+til\s+(\d+)\s+reps?$/i);
    if (match) {
      return {
        action: "updateExercise",
        exerciseName: match[1].trim(),
        reps: Number(match[2])
      };
    }

    match = text.match(/^sæt\s+pause(?:n)?\s+til\s+(.+)$/i);
    if (match) return { action: "updatePause", value: match[1].trim() };

    return null;
  }

  function log(command, structuredAction, result) {
    let history = [];
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      history = Array.isArray(stored) ? stored : [];
    } catch {}
    history.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      command: String(command || ""),
      structuredAction,
      result
    });
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch {}
  }

  function getHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(history) ? history : [];
    } catch {
      return [];
    }
  }

  window.AICopilotActions = { parse, log, getHistory };
})();
