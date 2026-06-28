(function calorieEstimatorModule() {
  "use strict";

  const intensityProfiles = {
    low: { label: "Lav", met: 3.5 },
    medium: { label: "Middel", met: 5.0 },
    high: { label: "Høj", met: 6.5 }
  };

  const loadTerms = {
    low: [
      "biceps curl", "barbell curl", "dumbbell curl", "hammer curl", "wrist curl",
      "triceps pushdown", "cable triceps pushdown", "rope pushdown", "lateral raise",
      "leg extension", "leg curl"
    ],
    medium: [
      "bench press", "bænkpres", "incline press", "incline dumbbell press",
      "incline barbell bench press", "chest press", "seated row", "seated cable row",
      "cable row", "lat pulldown", "shoulder press", "overhead press", "pull-up",
      "pull up", "pull-ups", "dip", "dips"
    ],
    high: [
      "back squat", "front squat", "squat", "deadlift", "dødløft",
      "romanian deadlift", "leg press", "walking lunge", "walking lunges",
      "bulgarian split squat", "hip thrust", "farmer walk", "farmer carry",
      "burpee", "burpees"
    ]
  };

  const loadFactors = {
    low: 0.94,
    medium: 1.03,
    high: 1.14,
    unknown: 1
  };

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function numberValue(value) {
    const number = Number.parseFloat(String(value ?? "").replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  }

  function normalizedText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function classifyExercise(name, muscle = "") {
    const text = normalizedText(`${name} ${muscle}`);
    for (const level of ["high", "medium", "low"]) {
      if (loadTerms[level].some(term => text.includes(term))) {
        return { level, source: "exercise_name", factor: loadFactors[level] };
      }
    }

    if (["biceps", "triceps"].includes(normalizedText(muscle))) {
      return { level: "low", source: "muscle_group", factor: loadFactors.low };
    }
    if (["bryst", "øvre ryg", "skuldre", "forside lår", "bagside lår & baller"].includes(normalizedText(muscle))) {
      return { level: "medium", source: "muscle_group", factor: loadFactors.medium };
    }
    return { level: "unknown", source: "fallback", factor: loadFactors.unknown };
  }

  function demographicFactor(profile) {
    const gender = String(profile?.gender || "");
    const age = numberValue(profile?.age);
    const genderFactor = gender === "man" ? 1.03 : gender === "woman" ? 0.97 : 1;
    const ageFactor = !age
      ? 1
      : age < 25
        ? 1.04
        : age < 40
          ? 1.01
          : age < 55
            ? 0.98
            : age < 70
              ? 0.94
              : 0.90;
    return { genderFactor, ageFactor, combined: genderFactor * ageFactor };
  }

  function summarizeExercises(exercises) {
    const distribution = { low: 0, medium: 0, high: 0, unknown: 0 };
    let totalSets = 0;
    let totalReps = 0;
    let totalVolumeKg = 0;
    let setsWithReps = 0;
    let setsWithWeight = 0;
    let classifiedByName = 0;

    const normalized = (Array.isArray(exercises) ? exercises : []).map(exercise => {
      const classification = classifyExercise(exercise?.name, exercise?.muscle);
      distribution[classification.level]++;
      if (classification.source === "exercise_name") classifiedByName++;

      const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
      totalSets += sets.length;
      sets.forEach(set => {
        const reps = numberValue(set?.reps);
        const weightKg = numberValue(set?.weight ?? set?.weightKg);
        if (reps > 0) setsWithReps++;
        if (weightKg > 0) setsWithWeight++;
        totalReps += reps;
        totalVolumeKg += weightKg * reps;
      });

      return {
        name: String(exercise?.name || ""),
        muscle: String(exercise?.muscle || ""),
        loadLevel: classification.level,
        loadSource: classification.source
      };
    });

    const exerciseCount = normalized.length;
    const weightedFactor = exerciseCount
      ? (
          distribution.low * loadFactors.low +
          distribution.medium * loadFactors.medium +
          distribution.high * loadFactors.high +
          distribution.unknown * loadFactors.unknown
        ) / exerciseCount
      : 1;

    return {
      exercises: normalized,
      exerciseCount,
      totalSets,
      totalReps,
      totalVolumeKg,
      setsWithReps,
      setsWithWeight,
      hasUsableSetData: setsWithReps > 0 || setsWithWeight > 0,
      distribution,
      weightedFactor,
      classifiedRatio: exerciseCount ? classifiedByName / exerciseCount : 0
    };
  }

  function precision(profile, durationSeconds, intensity, summary, durationSource) {
    let score = 0;
    const available = [];
    const missing = [];

    function add(name, condition, points = 1) {
      if (condition) {
        score += points;
        available.push(name);
      } else {
        missing.push(name);
      }
    }

    add("weightKg", numberValue(profile?.weightKg) > 0, 2);
    add("gender", ["man", "woman"].includes(profile?.gender), 1);
    add("age", numberValue(profile?.age) >= 13, 1);
    add("durationSeconds", durationSeconds > 0, 2);
    if (durationSource === "estimated") score = Math.max(0, score - 1);
    add("intensity", Boolean(intensityProfiles[intensity]), 1);
    add("exercises", summary.exerciseCount > 0, 1);
    add("sets", summary.totalSets > 0, 1);
    add("reps", summary.totalReps > 0, 1);
    add("volume", summary.totalVolumeKg > 0, 1);
    add("exerciseClassification", summary.classifiedRatio >= 0.5, 1);

    const level = score >= 9 ? "high" : score >= 6 ? "medium" : "low";
    return {
      level,
      label: { high: "Høj præcision", medium: "Middel præcision", low: "Lav præcision" }[level],
      icon: { high: "🟢", medium: "🟡", low: "🔴" }[level],
      score,
      maxScore: 12,
      available,
      missing
    };
  }

  function estimate(input = {}) {
    const profile = input.profile || {};
    const actualDurationSeconds = Math.max(0, numberValue(input.durationSeconds));
    const fallbackDurationSeconds = Math.max(0, numberValue(input.fallbackDurationSeconds));
    const canUseFallbackDuration = fallbackDurationSeconds > 0 &&
      (summaryPlaceholder(input.exercises) || actualDurationSeconds > 0);
    const durationSeconds = actualDurationSeconds >= 60
      ? actualDurationSeconds
      : canUseFallbackDuration
        ? fallbackDurationSeconds
        : actualDurationSeconds;
    const durationMinutes = durationSeconds / 60;
    const intensity = intensityProfiles[input.intensity] ? input.intensity : "medium";
    const intensityProfile = intensityProfiles[intensity];
    const weightKg = numberValue(profile.weightKg) || 75;
    const age = numberValue(profile.age) || null;
    const gender = ["man", "woman"].includes(profile.gender) ? profile.gender : "not_specified";
    const summary = summarizeExercises(input.exercises);
    const hasActivityBasis = actualDurationSeconds > 0 && summary.exerciseCount > 0;
    const canEstimate = summary.hasUsableSetData || hasActivityBasis;
    const durationSource = actualDurationSeconds >= 60
      ? "actual"
      : canUseFallbackDuration
        ? "estimated"
        : actualDurationSeconds > 0
          ? "actual"
          : "missing";
    const demographics = demographicFactor(profile);

    const baseCalories = intensityProfile.met * 3.5 * weightKg / 200 * durationMinutes;
    const volumePerMinute = durationMinutes > 0 ? summary.totalVolumeKg / durationMinutes : 0;
    const volumeAdjustment = clamp(Math.log10(1 + volumePerMinute / 50) * 0.07, 0, 0.18);
    const workAdjustment = clamp(summary.totalSets * 0.0025 + summary.totalReps * 0.00035, 0, 0.14);
    const exerciseFactor = summary.weightedFactor;
    const uncappedCalories = baseCalories
      * demographics.combined
      * (1 + volumeAdjustment + workAdjustment)
      * exerciseFactor;
    const maximumCaloriesPerMinute = clamp(weightKg * 0.22, 8, 20);
    const calories = canEstimate && durationMinutes > 0
      ? Math.round(clamp(uncappedCalories, 0, durationMinutes * maximumCaloriesPerMinute))
      : 0;
    const quality = precision(profile, durationSeconds, intensity, summary, durationSource);
    const missingForEstimate = [];
    if (!summary.exerciseCount) missingForEstimate.push("mindst én øvelse");
    if (!summary.hasUsableSetData && actualDurationSeconds <= 0) {
      missingForEstimate.push("træningstid eller registrerede reps/vægt");
    }

    return {
      schemaVersion: 1,
      estimatedCalories: calories,
      canEstimate,
      missingForEstimate,
      quality,
      inputs: {
        weightKg: numberValue(profile.weightKg) || null,
        gender,
        age,
        durationSeconds: Math.round(durationSeconds),
        actualDurationSeconds: Math.round(actualDurationSeconds),
        fallbackDurationSeconds: Math.round(fallbackDurationSeconds),
        durationSource,
        intensity,
        intensityLabel: intensityProfile.label,
        exerciseCount: summary.exerciseCount,
        totalSets: summary.totalSets,
        totalReps: Math.round(summary.totalReps),
        totalVolumeKg: Math.round(summary.totalVolumeKg * 10) / 10,
        setsWithReps: summary.setsWithReps,
        setsWithWeight: summary.setsWithWeight,
        exerciseLoadDistribution: summary.distribution
      },
      factors: {
        met: intensityProfile.met,
        demographicFactor: Math.round(demographics.combined * 1000) / 1000,
        volumeAdjustment: Math.round(volumeAdjustment * 1000) / 1000,
        workAdjustment: Math.round(workAdjustment * 1000) / 1000,
        exerciseFactor: Math.round(exerciseFactor * 1000) / 1000
      },
      calculatedAt: new Date().toISOString(),
      disclaimer: "Kalorieforbrug er et estimat og kan variere fra person til person."
    };
  }

  function summaryPlaceholder(exercises) {
    const summary = summarizeExercises(exercises);
    return summary.exerciseCount > 0 && summary.hasUsableSetData;
  }

  function toFirestoreRecord(estimateResult) {
    return JSON.parse(JSON.stringify(estimateResult || estimate()));
  }

  window.CalorieEstimator = {
    intensityProfiles,
    classifyExercise,
    estimate,
    toFirestoreRecord
  };
})();
