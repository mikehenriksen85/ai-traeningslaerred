(function (global) {
  "use strict";

  const CONFIGURABLE_WEIGHT_PROFILES = Object.freeze({
    dumbbell: Object.freeze({ step: 1, label: "håndvægte", source: "configurable-default" }),
    barbell: Object.freeze({ step: 2.5, label: "vægtstang", source: "configurable-default" }),
    cable: Object.freeze({ step: 2.5, label: "kabel", source: "configurable-default" }),
    machine: Object.freeze({ step: 5, label: "maskine", source: "configurable-default" }),
    kettlebell: Object.freeze({ step: 4, label: "kettlebell", source: "configurable-default" }),
    weighted_bodyweight: Object.freeze({ step: 1.25, label: "ekstra belastning", source: "configurable-default" }),
    external: Object.freeze({ step: 2.5, label: "belastning", source: "configurable-default" })
  });
  const VALID_STATUSES = new Set(["completed", "complete", "finished"]);

  function finiteNumber(value, minimum = 0, maximum = 2000) {
    const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
  }

  function repetitions(value) {
    const text = String(value ?? "").trim();
    return /^\d{1,3}$/.test(text) && Number(text) >= 1 && Number(text) <= 200 ? Number(text) : null;
  }

  function normalized(value) {
    return String(value || "").trim().toLocaleLowerCase("da-DK").normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
  }

  function parseRepRange(value) {
    const values = String(value || "").match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
    if (!values.length || /sek|min|time/i.test(String(value || ""))) return null;
    const min = Math.max(1, values[0]);
    const max = Math.max(min, values[1] || values[0]);
    return max <= 200 ? { min, max, text: min === max ? String(min) : `${min}-${max}` } : null;
  }

  function workoutIsValid(workout) {
    if (!workout || typeof workout !== "object" || workout.deletedAt || workout.isDeleted) return false;
    if (workout.simulated === true || workout.isSimulation === true || workout.source === "simulation") return false;
    const status = workout.workoutStatus || workout.sessionStatus || "completed";
    return VALID_STATUSES.has(String(status).toLowerCase());
  }

  function identityMatch(target, candidate) {
    const targetId = String(target?.exerciseId || "");
    const candidateId = String(candidate?.exerciseId || "");
    if (targetId && candidateId) return targetId === candidateId ? "exact" : "";
    const sameLegacyIdentity = normalized(target?.name) === normalized(candidate?.name)
      && normalized(target?.muscle) === normalized(candidate?.muscle);
    return sameLegacyIdentity ? "legacy" : "";
  }

  function progressionDataIsCompatible(target, candidate) {
    const targetUnit = normalized(target?.unit);
    const candidateUnit = normalized(candidate?.unit);
    if (targetUnit && candidateUnit && targetUnit !== candidateUnit) return false;
    const targetLoadType = normalized(target?.loadType);
    const candidateLoadType = normalized(candidate?.loadType);
    if (targetLoadType && candidateLoadType && targetLoadType !== candidateLoadType) return false;
    const targetEquipment = equipmentKey(target);
    const candidateEquipment = equipmentKey(candidate);
    if (target?.equipment && candidate?.equipment && targetEquipment !== candidateEquipment) return false;
    return true;
  }

  function completedWorkingSets(exercise) {
    return (Array.isArray(exercise?.sets) ? exercise.sets : []).filter(set => {
      if (!set || set.completed !== true) return false;
      if (set.isWarmup === true || String(set.setType || "").toLowerCase() === "warmup") return false;
      return repetitions(set.reps) !== null && finiteNumber(set.weight) !== null;
    }).map(set => ({
      weight: finiteNumber(set.weight),
      reps: repetitions(set.reps),
      targetReps: String(set.targetReps || "")
    }));
  }

  function performance(exercise, workout = {}) {
    const sets = completedWorkingSets(exercise);
    if (!sets.length) return null;
    const positiveWeights = sets.map(set => set.weight).filter(value => value > 0);
    const workingWeight = positiveWeights.length ? Math.max(...positiveWeights) : 0;
    const plannedSets = Math.max(1, Number(exercise.plannedSets || exercise.totalPlannedSets) || sets.length);
    const reps = sets.map(set => set.reps);
    return {
      exercise,
      workoutId: workout.sessionId || workout.id || exercise.workoutId || null,
      date: workout.completedAt || workout.date || exercise.completedAt || null,
      sets,
      reps,
      completedSets: sets.length,
      plannedSets,
      fullCompletion: sets.length >= plannedSets,
      workingWeight,
      totalReps: reps.reduce((sum, value) => sum + value, 0),
      totalVolume: sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
      targetReps: sets.find(set => parseRepRange(set.targetReps))?.targetReps || exercise.targetReps || ""
    };
  }

  function comparablePerformances(exercise, history) {
    const matches = [];
    (Array.isArray(history) ? history : []).filter(workoutIsValid).forEach(workout => {
      (Array.isArray(workout.exercises) ? workout.exercises : []).forEach(candidate => {
        if (candidate?.exerciseType === "cardio") return;
        const identity = identityMatch(exercise, candidate);
        if (!identity || !progressionDataIsCompatible(exercise, candidate)) return;
        const item = performance(candidate, workout);
        if (item) matches.push({ ...item, identity });
      });
    });
    return matches.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }

  function equipmentKey(exercise) {
    if (exercise?.loadType === "bodyweight") return "bodyweight";
    if (exercise?.loadType === "weighted_bodyweight") return "weighted_bodyweight";
    const value = normalized(exercise?.equipment);
    if (/håndvægt|handvaegt|dumbbell/.test(value)) return "dumbbell";
    if (/stang|barbell|ez-bar/.test(value)) return "barbell";
    if (/kabel|cable/.test(value)) return "cable";
    if (/maskine|machine/.test(value)) return "machine";
    if (/kettlebell/.test(value)) return "kettlebell";
    return "external";
  }

  function normalizedWeightOptions(exercise, currentPlan, availableWeightSteps) {
    const supplied = availableWeightSteps ?? currentPlan?.availableWeightSteps ?? currentPlan?.weightStep;
    if (Array.isArray(supplied)) {
      const values = [...new Set(supplied.map(value => finiteNumber(value)).filter(value => value !== null))].sort((a, b) => a - b);
      return { values, step: null, source: "configured-values", unit: currentPlan?.unit || "kg" };
    }
    if (supplied && typeof supplied === "object") {
      const values = Array.isArray(supplied.values)
        ? [...new Set(supplied.values.map(value => finiteNumber(value)).filter(value => value !== null))].sort((a, b) => a - b)
        : [];
      const step = finiteNumber(supplied.step, .01, 100);
      return { values, step, source: supplied.source || "configured", unit: supplied.unit || currentPlan?.unit || "kg" };
    }
    const explicitStep = finiteNumber(supplied, .01, 100);
    if (explicitStep) return { values: [], step: explicitStep, source: "configured-step", unit: currentPlan?.unit || "kg" };
    const profile = CONFIGURABLE_WEIGHT_PROFILES[equipmentKey(exercise)] || CONFIGURABLE_WEIGHT_PROFILES.external;
    return { values: [], step: profile.step, source: profile.source, unit: currentPlan?.unit || "kg" };
  }

  function tidyWeight(value) {
    return Math.round((value + Number.EPSILON) * 1000) / 1000;
  }

  function adjacentWeight(currentWeight, direction, options) {
    if (!(currentWeight > 0)) return null;
    if (options.values.length) {
      const candidates = direction > 0
        ? options.values.filter(value => value > currentWeight + .0001)
        : options.values.filter(value => value < currentWeight - .0001);
      return candidates.length ? (direction > 0 ? candidates[0] : candidates[candidates.length - 1]) : null;
    }
    return options.step ? tidyWeight(Math.max(0, currentWeight + direction * options.step)) : null;
  }

  function median(values) {
    const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function result(status, values = {}) {
    return {
      status,
      suggestedWeight: values.suggestedWeight ?? null,
      suggestedReps: values.suggestedReps ?? null,
      confidence: values.confidence || "low",
      reason: values.reason || "",
      basedOnWorkoutId: values.basedOnWorkoutId || null,
      unit: values.unit || "kg",
      weightStepSource: values.weightStepSource || null,
      identityConfidence: values.identityConfidence || "none"
    };
  }

  function calculateProgressionSuggestion(input = {}) {
    const exercise = input.exercise || {};
    const currentPlan = input.currentPlan || {};
    if (exercise.exerciseType === "cardio") return result("no-data", { reason: "Cardio bruger ikke automatisk vægtprogression." });
    const bodyweight = exercise.loadType === "bodyweight";
    const historyPerformances = comparablePerformances(exercise, input.history);
    let latest = input.previousPerformance ? performance(input.previousPerformance, input.previousPerformance) : null;
    let prior = historyPerformances;
    if (!latest) {
      latest = historyPerformances.at(-1) || null;
      prior = historyPerformances.slice(0, -1);
    } else if (latest.workoutId) {
      prior = historyPerformances.filter(item => item.workoutId !== latest.workoutId);
    }
    const fallbackReps = String(currentPlan.targetReps || exercise.targetReps || "") || null;
    const fallbackWeight = finiteNumber(currentPlan.weight);
    if (!latest) {
      return result("no-data", {
        suggestedWeight: bodyweight ? null : fallbackWeight,
        suggestedReps: fallbackReps,
        reason: "Ingen tidligere data – brug dette som dit udgangspunkt.",
        unit: currentPlan.unit || "kg"
      });
    }

    const range = parseRepRange(latest.targetReps || fallbackReps);
    const identityConfidence = latest.identity || (exercise.exerciseId && latest.exercise?.exerciseId === exercise.exerciseId ? "exact" : "legacy");
    const confidence = !latest.fullCompletion || identityConfidence === "legacy" ? "low" : prior.length ? "high" : "medium";
    const options = normalizedWeightOptions(exercise, currentPlan, input.availableWeightSteps);
    const base = {
      basedOnWorkoutId: latest.workoutId,
      unit: options.unit,
      weightStepSource: options.source,
      identityConfidence,
      confidence
    };
    if (!range) {
      return result("maintain", { ...base, suggestedWeight: bodyweight ? null : latest.workingWeight || fallbackWeight, suggestedReps: fallbackReps, reason: "Rep-intervallet kan ikke valideres. Behold derfor den nuværende plan." });
    }

    const meetsMinimum = latest.reps.every(reps => reps >= range.min);
    const reachesTop = latest.reps.every(reps => reps >= range.max);
    const previous = prior.at(-1) || null;
    const comparableWeights = prior.slice(-3).map(item => item.workingWeight).filter(value => value > 0);
    const comparableVolumes = prior.slice(-3).map(item => item.totalVolume).filter(value => value > 0);
    const typicalWeight = median(comparableWeights);
    const typicalVolume = median(comparableVolumes);
    const largeWeightSwing = typicalWeight > 0 && Math.abs(latest.workingWeight - typicalWeight) / typicalWeight > .25;
    const largeVolumeSwing = typicalVolume > 0 && Math.abs(latest.totalVolume - typicalVolume) / typicalVolume > .40;
    if ((largeWeightSwing || largeVolumeSwing) && prior.length >= 2) {
      return result("maintain", { ...base, confidence: "low", suggestedWeight: bodyweight ? null : latest.workingWeight, suggestedReps: range.text, reason: "Resultatet afviger meget fra din øvrige historik. Behold niveauet, indtil der er et mere stabilt grundlag." });
    }

    if (!latest.fullCompletion) {
      return result("maintain", { ...base, confidence: "low", suggestedWeight: bodyweight ? null : latest.workingWeight || fallbackWeight, suggestedReps: range.text, reason: "For få planlagte sæt blev gennemført til en sikker stigning. Behold niveauet næste gang." });
    }

    const previousRange = previous ? parseRepRange(previous.targetReps || range.text) : null;
    const previousMissedMinimum = previous && previous.fullCompletion && previousRange
      ? previous.reps.some(reps => reps < previousRange.min)
      : false;
    if (!meetsMinimum && previousMissedMinimum) {
      const lowerWeight = bodyweight ? null : adjacentWeight(latest.workingWeight, -1, options);
      return result(lowerWeight ? "reduce" : "maintain", {
        ...base,
        suggestedWeight: lowerWeight,
        suggestedReps: range.text,
        reason: lowerWeight
          ? "En lidt lavere vægt kan gøre det lettere at gennemføre alle planlagte reps."
          : "Behold niveauet og arbejd mod den nederste repgrænse."
      });
    }

    if (!meetsMinimum) {
      return result("maintain", { ...base, suggestedWeight: bodyweight ? null : latest.workingWeight || fallbackWeight, suggestedReps: range.text, reason: "Behold niveauet næste gang og forsøg at gennemføre alle reps. Én træning under målet udløser ikke en reduktion." });
    }

    const recentlyIncreased = previous && latest.workingWeight > previous.workingWeight + .0001 && latest.reps.every(reps => reps >= range.min);
    if (recentlyIncreased) {
      return result("maintain", { ...base, suggestedWeight: bodyweight ? null : latest.workingWeight, suggestedReps: range.text, reason: "Du har øget belastningen og holder stadig den nederste repgrænse. Behold den nye vægt og byg gradvist flere reps." });
    }

    if (reachesTop) {
      if (bodyweight) {
        return result("increase", { ...base, suggestedWeight: null, suggestedReps: `${range.min}-${Math.min(200, range.max + 1)}`, reason: "Alle planlagte sæt nåede toppen af intervallet. Overvej én ekstra rep eller en dokumenteret sværere variant." });
      }
      const higherWeight = adjacentWeight(latest.workingWeight, 1, options);
      const resetUpper = Math.max(range.min, Math.ceil((range.min + range.max) / 2));
      return result(higherWeight ? "increase" : "maintain", {
        ...base,
        suggestedWeight: higherWeight || latest.workingWeight,
        suggestedReps: range.min === resetUpper ? String(range.min) : `${range.min}-${resetUpper}`,
        reason: higherWeight
          ? "Alle planlagte sæt nåede toppen af rep-intervallet. Ét gyldigt vægttrin op er et forsigtigt næste skridt."
          : "Toppen af rep-intervallet er nået, men næste gyldige vægttrin er ikke kendt."
      });
    }

    return result("maintain", { ...base, suggestedWeight: bodyweight ? null : latest.workingWeight || fallbackWeight, suggestedReps: range.text, reason: "Behold samme niveau og forsøg at gennemføre én ekstra samlet rep næste gang." });
  }

  function formatSuggestion(suggestion) {
    if (!suggestion || suggestion.status === "no-data" && suggestion.suggestedWeight == null && !suggestion.suggestedReps) return "";
    const weight = suggestion.suggestedWeight != null ? `${String(suggestion.suggestedWeight).replace(".", ",")} ${suggestion.unit}` : "";
    const reps = suggestion.suggestedReps ? `${suggestion.suggestedReps} reps` : "";
    return [weight, reps].filter(Boolean).join(" × ");
  }

  global.Work4itProgression = Object.freeze({
    CONFIGURABLE_WEIGHT_PROFILES,
    calculateProgressionSuggestion,
    comparablePerformances,
    formatSuggestion,
    parseRepRange
  });
}(typeof window !== "undefined" ? window : globalThis));
