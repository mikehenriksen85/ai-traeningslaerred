(function (global) {
  "use strict";

  const EPSILON = 0.001;

  function number(value) {
    const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  function normalizedName(value) {
    return String(value || "").trim().toLocaleLowerCase("da-DK").replace(/\s+/g, " ");
  }

  function repetitions(value) {
    const text = String(value ?? "").trim();
    return /^\d{1,3}$/.test(text) && Number(text) > 0 ? Number(text) : 0;
  }

  function validDate(value) {
    const date = new Date(value || 0);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function completedSets(exercise) {
    return (Array.isArray(exercise?.sets) ? exercise.sets : []).filter(set => repetitions(set?.reps) > 0);
  }

  function metrics(exercise) {
    const sets = completedSets(exercise).map(set => {
      const weight = number(set.weight);
      const reps = repetitions(set.reps);
      return {
        weight,
        reps,
        targetReps: String(set.targetReps || ""),
        volume: weight > 0 ? weight * reps : 0,
        oneRm: weight > 0 ? number(set.oneRm) || weight * (1 + reps / 30) : 0
      };
    });
    const maxWeight = Math.max(0, ...sets.map(set => set.weight));
    return {
      sets,
      completedSets: sets.length,
      totalVolumeKg: sets.reduce((sum, set) => sum + set.volume, 0),
      bestOneRm: Math.max(0, ...sets.map(set => set.oneRm)),
      maxWeight,
      repsAtMaxWeight: Math.max(0, ...sets.filter(set => Math.abs(set.weight - maxWeight) < EPSILON).map(set => set.reps))
    };
  }

  function comparableHistory(currentWorkout, workoutHistory) {
    return (Array.isArray(workoutHistory) ? workoutHistory : []).filter(workout => {
      if (!workout || typeof workout !== "object") return false;
      if (currentWorkout?.sessionId && workout.sessionId === currentWorkout.sessionId) return false;
      if (currentWorkout?.id && workout.id === currentWorkout.id) return false;
      return true;
    });
  }

  function historyForExercise(name, history) {
    const key = normalizedName(name);
    return history.flatMap(workout => (Array.isArray(workout.exercises) ? workout.exercises : [])
      .filter(exercise => normalizedName(exercise?.name) === key)
      .map(exercise => ({ workout, exercise, metrics: metrics(exercise) })))
      .filter(item => item.metrics.completedSets > 0)
      .sort((a, b) => (validDate(a.workout.completedAt || a.workout.date)?.getTime() || 0) - (validDate(b.workout.completedAt || b.workout.date)?.getTime() || 0));
  }

  function record(records, exercise, type, value, previousValue, unit, label) {
    if (!(value > previousValue + EPSILON) || !(previousValue > 0)) return;
    records.push({ exercise, type, value, previousValue, unit, message: `${exercise}: ny ${label}` });
  }

  function parseRepRange(value) {
    const matches = String(value || "").match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
    if (!matches.length) return null;
    return { min: matches[0], max: matches[1] || matches[0] };
  }

  function exerciseRecommendation(exercise, currentMetrics, comparison) {
    const rangedSets = currentMetrics.sets.map(set => ({ set, range: parseRepRange(set.targetReps) })).filter(item => item.range);
    const plannedSets = Math.max(0, Number(exercise.plannedSets) || currentMetrics.completedSets);
    const allPlannedCompleted = plannedSets > 0 && currentMetrics.completedSets >= plannedSets;
    if (rangedSets.length === currentMetrics.completedSets && allPlannedCompleted) {
      if (rangedSets.every(({ set, range }) => set.reps >= range.max)) {
        return currentMetrics.maxWeight > 0
          ? `Forslag til ${exercise.name}: Overvej at øge belastningen lidt næste gang.`
          : `Forslag til ${exercise.name}: Overvej en lidt sværere variant næste gang.`;
      }
      if (rangedSets.some(({ set, range }) => set.reps < range.min)) {
        return `Forslag til ${exercise.name}: Behold niveauet næste gang og forsøg at gennemføre alle planlagte reps.`;
      }
    }
    if (comparison === "stable" && currentMetrics.maxWeight > 0) {
      return `Forslag til ${exercise.name}: Fortsæt med samme belastning, indtil alle sæt ligger stabilt i den ønskede rep-range.`;
    }
    return "";
  }

  function analyzeCompletedWorkout(currentWorkout, workoutHistory = []) {
    const current = currentWorkout && typeof currentWorkout === "object" ? currentWorkout : {};
    const history = comparableHistory(current, workoutHistory);
    const exercises = (Array.isArray(current.exercises) ? current.exercises : []).filter(exercise => {
      if (exercise?.exerciseType === "cardio") return exercise?.cardio?.completed !== false;
      return completedSets(exercise).length > 0;
    });
    const personalRecords = [];
    const details = [];
    const progress = [];
    const stable = [];
    const lower = [];
    const recommendations = [];
    let comparableExercises = 0;

    exercises.forEach(exercise => {
      if (exercise.exerciseType === "cardio") {
        details.push({ name: exercise.name || "Cardio", exerciseType: "cardio", completedSets: 0, totalVolumeKg: 0, comparison: "baseline" });
        return;
      }
      const currentMetrics = metrics(exercise);
      const previous = historyForExercise(exercise.name, history);
      let comparison = "baseline";
      if (previous.length) {
        comparableExercises++;
        const latest = previous[previous.length - 1].metrics;
        const historicalMaxWeight = Math.max(0, ...previous.map(item => item.metrics.maxWeight));
        const historicalBestOneRm = Math.max(0, ...previous.map(item => item.metrics.bestOneRm));
        const historicalBestVolume = Math.max(0, ...previous.map(item => item.metrics.totalVolumeKg));
        record(personalRecords, exercise.name, "weight", currentMetrics.maxWeight, historicalMaxWeight, "kg", "vægtrekord");
        record(personalRecords, exercise.name, "estimatedOneRm", currentMetrics.bestOneRm, historicalBestOneRm, "kg", "estimeret 1RM");
        record(personalRecords, exercise.name, "volume", currentMetrics.totalVolumeKg, historicalBestVolume, "kg", "volumenrekord");

        const higherWeightSameReps = currentMetrics.maxWeight > latest.maxWeight + EPSILON
          && currentMetrics.repsAtMaxWeight >= latest.repsAtMaxWeight;
        const sameWeightMoreReps = Math.abs(currentMetrics.maxWeight - latest.maxWeight) < EPSILON
          && currentMetrics.repsAtMaxWeight > latest.repsAtMaxWeight;
        const volumeChange = latest.totalVolumeKg > 0
          ? (currentMetrics.totalVolumeKg - latest.totalVolumeKg) / latest.totalVolumeKg
          : 0;
        if (higherWeightSameReps || sameWeightMoreReps || volumeChange > 0.05) {
          comparison = "progress";
          progress.push(exercise.name);
        } else if (latest.totalVolumeKg > 0 && volumeChange < -0.05) {
          comparison = "lower";
          lower.push(exercise.name);
        } else {
          comparison = "stable";
          stable.push(exercise.name);
        }
      }
      const recommendation = exerciseRecommendation(exercise, currentMetrics, comparison);
      if (recommendation) recommendations.push({ type: "progression", exercise: exercise.name, message: recommendation });
      details.push({
        name: exercise.name,
        exerciseType: "strength",
        completedSets: currentMetrics.completedSets,
        totalVolumeKg: currentMetrics.totalVolumeKg,
        bestOneRm: currentMetrics.bestOneRm,
        maxWeight: currentMetrics.maxWeight,
        comparison
      });
    });

    const insights = [];
    if (personalRecords.length) {
      const exerciseCount = new Set(personalRecords.map(item => normalizedName(item.exercise))).size;
      insights.push({ type: "record", priority: 1, message: exerciseCount === 1 ? `Ny dokumenteret rekord i ${personalRecords[0].exercise}.` : `Nye dokumenterede rekorder i ${exerciseCount} øvelser.` });
    }
    if (progress.length) insights.push({ type: "progress", priority: 2, message: `Fremgang registreret i ${progress.slice(0, 2).join(" og ")}.` });
    if (stable.length) insights.push({ type: "stable", priority: 3, message: `Stabil præstation i ${stable.slice(0, 2).join(" og ")}.` });
    if (lower.length) insights.push({ type: "recovery", priority: 4, message: `Dagens resultat i ${lower.slice(0, 2).join(" og ")} var lidt lavere end sidst. Søvn, energi og restitution kan påvirke præstationen.` });
    if (!comparableExercises) insights.push({ type: "baseline", priority: 2, message: "Denne træning er nu gemt som dit udgangspunkt." });

    const completedAt = validDate(current.completedAt || current.date);
    if (completedAt) {
      const weekStart = completedAt.getTime() - 7 * 24 * 60 * 60 * 1000;
      const recentCount = history.filter(workout => {
        const date = validDate(workout.completedAt || workout.date);
        return date && date.getTime() >= weekStart && date.getTime() <= completedAt.getTime();
      }).length + 1;
      if (recentCount >= 2 && recentCount <= 7) insights.push({ type: "consistency", priority: 5, message: `Du har gennemført ${recentCount} træninger de seneste 7 dage.` });
    }

    const completedSetCount = details.reduce((sum, detail) => sum + detail.completedSets, 0);
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      summary: {
        durationSeconds: Math.max(0, Math.round(number(current.durationSeconds))),
        completedExercises: exercises.length,
        completedSets: completedSetCount,
        totalVolumeKg: details.reduce((sum, detail) => sum + number(detail.totalVolumeKg), 0),
        personalRecords
      },
      insights: insights.sort((a, b) => a.priority - b.priority).slice(0, 4),
      recommendations: recommendations.slice(0, 3),
      details
    };
  }

  global.Work4itCompletedWorkoutAnalysis = Object.freeze({ analyzeCompletedWorkout });
}(typeof window !== "undefined" ? window : globalThis));
