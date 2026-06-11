(function trainingGoalEngineModule() {
  "use strict";

  const profiles = {
    muscle_gain: {
      label: "Muskelopbygning",
      structure: "Hypertrofi med moderat til høj volumen",
      defaultSplit: "upper_lower",
      setRange: [3, 5],
      exerciseCount: [5, 8],
      workSeconds: 45
    },
    weight_loss: {
      label: "Vægttab",
      structure: "Helkrop med høj træningstæthed",
      defaultSplit: "fullbody_rotation",
      setRange: [2, 4],
      exerciseCount: [6, 9],
      workSeconds: 40
    },
    strength: {
      label: "Styrke",
      structure: "Basisløft med lave reps og lange pauser",
      defaultSplit: "strength_lifts",
      setRange: [2, 5],
      exerciseCount: [4, 6],
      workSeconds: 35
    },
    general_health: {
      label: "Generel sundhed",
      structure: "Balanceret styrke, stabilitet og funktion",
      defaultSplit: "balanced_fullbody",
      setRange: [2, 3],
      exerciseCount: [5, 7],
      workSeconds: 40
    }
  };

  const compoundTerms = [
    "squat", "deadlift", "bench press", "chest press", "overhead press", "shoulder press",
    "pull-up", "pull up", "chin-up", "chin up", "row", "dip", "leg press", "hip thrust",
    "lunge", "split squat", "step-up", "step up", "landmine press"
  ];
  const primaryStrengthTerms = [
    "back squat", "front squat", "deadlift", "sumo deadlift", "bench press",
    "overhead press", "barbell row", "weighted pull-up", "weighted chin-up"
  ];
  const isolationTerms = [
    "curl", "pushdown", "extension", "lateral raise", "front raise", "fly", "pec deck",
    "leg curl", "leg extension", "kickback", "frog pump"
  ];
  const conditioningTerms = [
    "kettlebell swing", "mountain climber", "walking lunge", "farmer carry", "suitcase carry",
    "step-up", "step up", "push-up", "thruster", "burpee", "inverted row"
  ];
  const stabilityTerms = [
    "plank", "dead bug", "bird dog", "pallof", "carry", "mcgill", "hip hinge drill",
    "scapular", "wall sit", "hollow body", "stir-the-pot"
  ];
  const unilateralTerms = [
    "single-leg", "single-arm", "one-arm", "split squat", "lunge", "step-up", "step up"
  ];

  function includesAny(text, terms) {
    return terms.some(term => text.includes(term));
  }

  function classifyExercise(name, muscle) {
    const text = `${name || ""} ${muscle || ""}`.toLowerCase();
    const isCoreMuscle = ["Mave", "Nedre ryg / lænd"].includes(muscle);
    return {
      compound: includesAny(text, compoundTerms),
      primaryStrength: includesAny(text, primaryStrengthTerms),
      isolation: includesAny(text, isolationTerms) || ["Biceps", "Triceps"].includes(muscle),
      conditioning: includesAny(text, conditioningTerms),
      stability: isCoreMuscle || includesAny(text, stabilityTerms),
      unilateral: includesAny(text, unilateralTerms),
      largeMuscle: ["Bryst", "Øvre ryg", "Skuldre", "Forside lår", "Bagside lår & baller"].includes(muscle)
    };
  }

  function exerciseRole(name, muscle) {
    const traits = classifyExercise(name, muscle);
    if (traits.primaryStrength) return "primary";
    if (traits.conditioning) return "conditioning";
    if (traits.stability) return "stability";
    if (traits.isolation) return "isolation";
    if (traits.compound) return "compound";
    return traits.largeMuscle ? "compound" : "accessory";
  }

  function scoreExercise(exercise, goal, position = 0) {
    const traits = classifyExercise(exercise.name, exercise.muscle);
    let score = 10;

    if (goal === "muscle_gain") {
      score += traits.compound ? 8 : 0;
      score += traits.isolation ? 6 : 0;
      score += traits.largeMuscle ? 4 : 0;
      score += traits.stability ? -3 : 0;
    } else if (goal === "weight_loss") {
      score += traits.conditioning ? 14 : 0;
      score += traits.compound ? 10 : 0;
      score += traits.unilateral ? 5 : 0;
      score += traits.largeMuscle ? 5 : 0;
      score += traits.isolation ? -8 : 0;
      score += traits.primaryStrength ? -2 : 0;
    } else if (goal === "strength") {
      score += traits.primaryStrength ? 18 : 0;
      score += traits.compound ? 9 : 0;
      score += traits.isolation ? -6 : 0;
      score += traits.conditioning ? -8 : 0;
      score += position < 2 && traits.primaryStrength ? 5 : 0;
    } else {
      score += traits.compound ? 6 : 0;
      score += traits.stability ? 7 : 0;
      score += traits.unilateral ? 5 : 0;
      score += traits.conditioning ? 3 : 0;
      score += traits.primaryStrength ? -1 : 0;
    }
    return score;
  }

  function rankExercises(exercises, goal, seed = 0) {
    return [...exercises]
      .map((exercise, index) => ({
        exercise,
        score: scoreExercise(exercise, goal, index) + ((index + seed) % 5) * .05
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.exercise);
  }

  function prescription(name, muscle, goal = "general_health", experience = "intermediate", position = 0) {
    const role = exerciseRole(name, muscle);
    const traits = classifyExercise(name, muscle);
    const experienced = experience === "experienced";
    const beginner = experience === "beginner";
    let sets;
    let targetReps;
    let pauseSeconds;

    if (goal === "muscle_gain") {
      sets = role === "primary" || role === "compound" ? (experienced ? 5 : beginner ? 3 : 4) : 3;
      targetReps = traits.isolation ? "10-15" : role === "primary" ? "6-10" : "8-12";
      pauseSeconds = role === "primary" ? 120 : traits.isolation ? 60 : 90;
    } else if (goal === "weight_loss") {
      sets = beginner ? 2 : 3;
      targetReps = traits.stability ? "30-45 sek." : traits.conditioning ? "12-20" : "10-15";
      pauseSeconds = traits.stability ? 30 : traits.compound ? 60 : 45;
    } else if (goal === "strength") {
      sets = role === "primary" ? (beginner ? 3 : experienced ? 5 : 4) : traits.compound ? 3 : 2;
      targetReps = role === "primary" ? "3-5" : traits.compound ? "5-8" : "6-10";
      pauseSeconds = role === "primary" ? 240 : traits.compound ? 150 : 90;
    } else {
      sets = beginner ? 2 : 3;
      targetReps = traits.stability ? "30-45 sek." : "8-15";
      pauseSeconds = traits.stability ? 45 : traits.compound ? 90 : 60;
    }

    if (position >= 5 && goal !== "muscle_gain") sets = Math.max(2, sets - 1);
    return { sets, targetReps, pauseSeconds, role, goal };
  }

  function splitFor(goal, days) {
    if (goal === "weight_loss") {
      return Array.from({ length: days }, (_, index) => ({
        key: "fullbody",
        title: `Helkrop med høj tæthed ${index + 1}`
      }));
    }
    if (goal === "strength") {
      const strengthDays = [
        ["squat", "Squat og benstyrke"],
        ["press", "Presstyrke"],
        ["deadlift", "Dødløft og bagkæde"],
        ["upper", "Overkropsstyrke"]
      ];
      return Array.from({ length: days }, (_, index) => ({
        key: strengthDays[index % strengthDays.length][0],
        title: strengthDays[index % strengthDays.length][1]
      }));
    }
    if (goal === "muscle_gain" && days >= 3) {
      const hypertrophy = days === 3
        ? [["push", "Push hypertrofi"], ["pull", "Pull hypertrofi"], ["legs", "Ben hypertrofi"]]
        : [["upper", "Overkrop hypertrofi"], ["lower", "Underkrop hypertrofi"]];
      return Array.from({ length: days }, (_, index) => ({
        key: hypertrophy[index % hypertrophy.length][0],
        title: hypertrophy[index % hypertrophy.length][1]
      }));
    }
    const health = [
      ["balanced", "Balanceret helkrop"],
      ["movement", "Bevægelse og styrke"],
      ["stability", "Stabilitet og funktion"]
    ];
    return Array.from({ length: days }, (_, index) => ({
      key: health[index % health.length][0],
      title: health[index % health.length][1]
    }));
  }

  function profile(goal) {
    return profiles[goal] || profiles.general_health;
  }

  function recommendation(goal) {
    const p = profile(goal);
    if (goal === "muscle_gain") return `${p.label}: prioritér muskelstimulering, 6-15 reps og moderat til høj volumen.`;
    if (goal === "weight_loss") return `${p.label}: prioritér helkrop, store bevægelser, korte pauser og høj træningstæthed.`;
    if (goal === "strength") return `${p.label}: prioritér tunge basisløft, lave reps, lavere volumen og lange pauser.`;
    return `${p.label}: prioritér balance mellem styrke, stabilitet, funktion og bæredygtig progression.`;
  }

  window.TrainingGoalEngine = {
    profiles,
    profile,
    classifyExercise,
    exerciseRole,
    scoreExercise,
    rankExercises,
    prescription,
    splitFor,
    recommendation
  };
})();
