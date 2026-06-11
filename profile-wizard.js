(function profileWizardModule() {
  "use strict";

  const goals = [
    { value: "muscle_gain", label: "Muskelopbygning" },
    { value: "weight_loss", label: "Vægttab" },
    { value: "strength", label: "Styrke" },
    { value: "general_health", label: "Generel sundhed" }
  ];
  const genders = [
    { value: "man", label: "Mand" },
    { value: "woman", label: "Kvinde" },
    { value: "not_specified", label: "Ønsker ikke at oplyse" }
  ];
  const experienceLevels = [
    { value: "beginner", label: "Nybegynder" },
    { value: "light_intermediate", label: "Let øvet" },
    { value: "intermediate", label: "Øvet" },
    { value: "experienced", label: "Erfaren" }
  ];
  const focusAreas = ["Bryst", "Skuldre", "Arme", "Ben", "Core", "Ryg"];
  const preferences = [
    {
      value: "variation",
      label: "Jeg ønsker variation",
      description: "Appen må rotere mellem lignende øvelser for mindre ensformighed."
    },
    {
      value: "consistent",
      label: "Jeg foretrækker faste øvelser",
      description: "De samme øvelser prioriteres, så progression er lettere at sammenligne."
    },
    {
      value: "mixed",
      label: "Lidt af begge dele",
      description: "Basisøvelser bevares, mens hjælpeøvelser må variere."
    }
  ];
  const exercisePools = {
    Bryst: [
      ["Barbell Bench Press", "Bryst"], ["Incline Dumbbell Press", "Bryst"],
      ["Machine Chest Press", "Bryst"], ["Cable Fly", "Bryst"],
      ["Weighted Push-ups", "Bryst"], ["Push-ups", "Bryst"], ["Chest Dips", "Bryst"]
    ],
    Skuldre: [
      ["Overhead Press", "Skuldre"], ["Dumbbell Shoulder Press", "Skuldre"],
      ["Arnold Press", "Skuldre"], ["Lateral Raise", "Skuldre"],
      ["Cable Lateral Raise", "Skuldre"], ["Rear Delt Fly", "Skuldre"]
    ],
    Arme: [
      ["Barbell Curl", "Biceps"], ["Hammer Curl", "Biceps"],
      ["Incline Dumbbell Curl", "Biceps"], ["Cable Triceps Pushdown", "Triceps"],
      ["Overhead Cable Extension", "Triceps"], ["Skull Crusher", "Triceps"]
    ],
    Ben: [
      ["Back Squat", "Forside lår"], ["Leg Press", "Forside lår"],
      ["Bulgarian Split Squat", "Forside lår"], ["Walking Lunge", "Forside lår"],
      ["Step-up", "Forside lår"], ["Romanian Deadlift", "Bagside lår & baller"],
      ["Hip Thrust", "Bagside lår & baller"], ["Kettlebell Swing", "Bagside lår & baller"],
      ["Seated Leg Curl", "Bagside lår & baller"]
    ],
    Core: [
      ["Plank", "Mave"], ["Dead Bug", "Mave"], ["Ab Wheel Rollout", "Mave"],
      ["Cable Crunch", "Mave"], ["Pallof Press", "Mave"], ["Mountain Climber", "Mave"],
      ["Farmer Carry", "Mave"], ["Bird Dog", "Nedre ryg / lænd"]
    ],
    Ryg: [
      ["Pull-ups", "Øvre ryg"], ["Lat Pulldown", "Øvre ryg"],
      ["Chest-Supported Row", "Øvre ryg"], ["Barbell Row", "Øvre ryg"],
      ["Seated Cable Row", "Øvre ryg"], ["One-Arm Dumbbell Row", "Øvre ryg"],
      ["Inverted Row", "Øvre ryg"]
    ]
  };

  let state = null;
  const totalSteps = 7;

  function freshState(mode) {
    const profile = window.TrainingWizardStore?.getProfile?.() || {};
    return {
      mode,
      step: 1,
      goal: profile.goal || "",
      heightCm: profile.heightCm || "",
      weightKg: profile.weightKg || "",
      age: profile.age || "",
      gender: profile.gender || "",
      experience: profile.experience || "",
      trainingDaysPerWeek: Number(profile.trainingDaysPerWeek) || 3,
      focusAreas: Array.isArray(profile.focusAreas) ? [...profile.focusAreas] : [],
      exercisePreference: profile.exercisePreference || "",
      selectedProgramDay: 0,
      generatedPrograms: []
    };
  }

  function labelFor(options, value) {
    return options.find(option => option.value === value)?.label || value || "-";
  }

  function optionButtons(options, selected, action, multiple = false) {
    return options.map(option => {
      const value = typeof option === "string" ? option : option.value;
      const label = typeof option === "string" ? option : option.label;
      const description = typeof option === "string" ? "" : option.description;
      const active = multiple ? selected.includes(value) : selected === value;
      return `<button type="button" class="wizard-option${active ? " selected" : ""}${description ? " descriptive" : ""}" data-action="${action}" data-value="${value}">
        <strong>${label}</strong>${description ? `<span>${description}</span>` : ""}
      </button>`;
    }).join("");
  }

  function setCount() {
    return window.TrainingGoalEngine?.prescription?.(
      "Generic Exercise",
      "Øvre ryg",
      state.goal,
      state.experience
    ).sets || 3;
  }

  function exercisesPerDay() {
    const range = window.TrainingGoalEngine?.profile?.(state.goal).exerciseCount || [5, 7];
    if (state.trainingDaysPerWeek <= 2) return range[1];
    if (state.trainingDaysPerWeek >= 5) return range[0];
    return Math.round((range[0] + range[1]) / 2);
  }

  function selectedFocus() {
    const selected = state.focusAreas.length ? state.focusAreas : ["Bryst", "Ryg", "Ben", "Core"];
    const support = ["Bryst", "Ryg", "Ben", "Skuldre", "Arme", "Core"];
    return [...selected, ...support.filter(area => !selected.includes(area))];
  }

  function generatePrograms() {
    const engine = window.TrainingGoalEngine;
    const areas = selectedFocus();
    const count = exercisesPerDay();
    const usedGlobally = new Set();
    const programs = [];
    const splits = engine?.splitFor?.(state.goal, state.trainingDaysPerWeek) || [];

    function areasForSplit(splitKey) {
      const maps = {
        push: ["Bryst", "Skuldre", "Arme"],
        pull: ["Ryg", "Arme", "Core"],
        legs: ["Ben", "Core"],
        lower: ["Ben", "Core"],
        upper: ["Bryst", "Ryg", "Skuldre", "Arme"],
        squat: ["Ben", "Core", "Ryg"],
        press: ["Bryst", "Skuldre", "Arme", "Core"],
        deadlift: ["Ben", "Ryg", "Core"],
        stability: ["Core", "Ben", "Ryg", "Skuldre"]
      };
      const preferred = maps[splitKey] || areas;
      return [...preferred.filter(area => exercisePools[area]), ...areas.filter(area => !preferred.includes(area))];
    }

    for (let day = 0; day < state.trainingDaysPerWeek; day++) {
      const exercises = [];
      const split = splits[day] || { key: "balanced", title: `Dag ${day + 1}` };
      const dayAreas = areasForSplit(split.key);
      for (let slot = 0; slot < count; slot++) {
        const area = dayAreas[(day + slot) % dayAreas.length];
        const pool = exercisePools[area] || exercisePools.Ryg;
        const ranked = engine?.rankExercises?.(
          pool.map(item => ({ name: item[0], muscle: item[1] })),
          state.goal,
          day + slot
        ) || pool.map(item => ({ name: item[0], muscle: item[1] }));
        let index = (day + slot) % ranked.length;

        if (state.exercisePreference === "consistent") index = slot % Math.min(3, ranked.length);
        if (state.exercisePreference === "mixed" && slot < 2) index = slot % Math.min(2, ranked.length);

        let candidate = ranked[index];
        if (state.exercisePreference !== "consistent") {
          candidate = ranked.find(item => !usedGlobally.has(item.name)) || candidate;
        }
        if (exercises.some(item => item.name === candidate.name)) {
          candidate = ranked.find(item => !exercises.some(existing => existing.name === item.name)) || candidate;
        }

        usedGlobally.add(candidate.name);
        const prescription = engine?.prescription?.(
          candidate.name,
          candidate.muscle,
          state.goal,
          state.experience,
          slot
        ) || { sets: setCount(), targetReps: "8-12", pauseSeconds: 90, role: "accessory", goal: state.goal };
        exercises.push({ ...candidate, ...prescription });
      }
      programs.push({
        title: `Dag ${day + 1}: ${split.title}`,
        goal: state.goal,
        structure: engine?.profile?.(state.goal).structure || "",
        exercises
      });
    }

    state.generatedPrograms = programs;
    state.selectedProgramDay = Math.min(state.selectedProgramDay, programs.length - 1);
    return programs;
  }

  function estimatedMinutes(exercises) {
    const workSeconds = window.TrainingGoalEngine?.profile?.(state.goal).workSeconds || 45;
    const setTotal = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    const work = setTotal * workSeconds;
    const setRest = exercises.reduce((sum, exercise) =>
      sum + Math.max(0, exercise.sets - 1) * exercise.pauseSeconds, 0);
    const transition = state.goal === "weight_loss" ? 45 : state.goal === "strength" ? 120 : 90;
    const exerciseRest = Math.max(0, exercises.length - 1) * transition;
    return Math.ceil((work + setRest + exerciseRest) / 60);
  }

  function stepHtml() {
    if (state.step === 1) {
      return `<h2 class="wizard-step-title">Hvad er dit vigtigste træningsmål?</h2>
        <p class="wizard-help">Vælg det mål, der passer bedst til dit fokus lige nu.</p>
        <div class="wizard-options">${optionButtons(goals, state.goal, "goal")}</div>`;
    }
    if (state.step === 2) {
      return `<h2 class="wizard-step-title">Fortæl lidt om dig</h2>
        <p class="wizard-help">Oplysningerne gemmes lokalt i din profil og kan ændres senere.</p>
        <div class="wizard-fields">
          <label>Højde (cm)<input data-field="heightCm" type="number" min="50" max="250" value="${state.heightCm}"></label>
          <label>Vægt (kg)<input data-field="weightKg" type="number" min="1" step="0.1" value="${state.weightKg}"></label>
          <label>Alder<input data-field="age" type="number" min="13" max="100" value="${state.age}"></label>
        </div>
        <div class="wizard-subtitle">Køn</div>
        <div class="wizard-options compact">${optionButtons(genders, state.gender, "gender")}</div>
        ${state.gender === "not_specified" ? `
          <div class="wizard-information" role="status">
            <strong>Bemærk om beregninger</strong>
            <span>BMI kan stadig beregnes ud fra højde og vægt, fordi BMI-formlen ikke afhænger af køn. Uden oplysning om køn kan kønsspecifikke estimater som energibehov, fortolkning af fedtprocent og visse træningsanbefalinger dog blive mindre præcise.</span>
          </div>` : ""}`;
    }
    if (state.step === 3) {
      return `<h2 class="wizard-step-title">Hvad er dit erfaringsniveau?</h2>
        <p class="wizard-help">Niveauet bruges til at tilpasse programmets mængde og kompleksitet.</p>
        <div class="wizard-options">${optionButtons(experienceLevels, state.experience, "experience")}</div>`;
    }
    if (state.step === 4) {
      const days = Array.from({ length: 7 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));
      return `<h2 class="wizard-step-title">Hvor ofte vil du træne?</h2>
        <p class="wizard-help">Vælg antal træningsdage pr. uge.</p>
        <div class="wizard-days">${optionButtons(days, String(state.trainingDaysPerWeek), "days")}</div>`;
    }
    if (state.step === 5) {
      return `<h2 class="wizard-step-title">Vælg dine fokusområder</h2>
        <p class="wizard-help">Vælg gerne flere områder. Tryk derefter på Næste.</p>
        <div class="wizard-options">${optionButtons(focusAreas, state.focusAreas, "focus", true)}</div>`;
    }
    if (state.step === 6) {
      return `<h2 class="wizard-step-title">Foretrækker du variation eller faste rutiner?</h2>
        <p class="wizard-help">Valget bruges ved fremtidig programgenerering og anbefalinger.</p>
        <div class="wizard-options single-column">${optionButtons(preferences, state.exercisePreference, "preference")}</div>`;
    }

    const programs = state.generatedPrograms.length === state.trainingDaysPerWeek
      ? state.generatedPrograms
      : generatePrograms();
    const program = programs[state.selectedProgramDay] || programs[0];
    const averageMinutes = Math.round(programs.reduce((sum, item) => sum + estimatedMinutes(item.exercises), 0) / programs.length);
    return `<h2 class="wizard-step-title">${state.mode === "edit" ? "Opdateret programforslag" : "Dit programforslag"}</h2>
      <p class="wizard-help">Forslaget indeholder et forskelligt træningspas til hver valgte træningsdag.</p>
      <div class="wizard-summary">
        <div><span>Mål og niveau</span><strong>${labelFor(goals, state.goal)} · ${labelFor(experienceLevels, state.experience)}</strong></div>
        <div><span>Plan</span><strong>${state.trainingDaysPerWeek} træningsdage · ca. ${averageMinutes} min pr. pas</strong></div>
        <div><span>Øvelsesstil</span><strong>${labelFor(preferences, state.exercisePreference)}</strong></div>
      </div>
      <div class="wizard-tabs">${programs.map((item, index) => `<button type="button" class="${index === state.selectedProgramDay ? "selected" : ""}" data-action="program-day" data-value="${index}">Dag ${index + 1}</button>`).join("")}</div>
      <div class="wizard-program">${program.exercises.map((exercise, index) => `<div><span>${index + 1}. ${exercise.name}</span><span>${exercise.sets} × ${exercise.targetReps} · ${exercise.pauseSeconds} sek.</span></div>`).join("")}</div>`;
  }

  function canContinue() {
    if (state.step === 1) return Boolean(state.goal);
    if (state.step === 2) {
      return Number(state.heightCm) >= 50 && Number(state.weightKg) > 0 &&
        Number(state.age) >= 13 && Boolean(state.gender);
    }
    if (state.step === 3) return Boolean(state.experience);
    if (state.step === 4) return state.trainingDaysPerWeek > 0;
    if (state.step === 5) return state.focusAreas.length > 0;
    if (state.step === 6) return Boolean(state.exercisePreference);
    return true;
  }

  function render() {
    const root = document.getElementById("profile-wizard-root");
    if (!root || !state) return;
    const progress = Math.round((state.step / totalSteps) * 100);
    root.innerHTML = `<div class="wizard-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-wizard-title">
      <section class="wizard-panel">
        <header class="wizard-head">
          <div class="wizard-head-row">
            <div class="wizard-title" id="profile-wizard-title">${state.mode === "edit" ? "Rediger profilopsætning" : "Kom godt i gang"}</div>
            <button type="button" class="wizard-close" data-action="close" aria-label="Luk">×</button>
          </div>
          <div class="wizard-progress"><span style="width:${progress}%"></span></div>
          <div class="wizard-progress-meta"><span>Trin ${state.step} af ${totalSteps}</span><span>${progress}%</span></div>
        </header>
        <div class="wizard-content">${stepHtml()}</div>
        <footer class="wizard-footer">
          <button type="button" class="wizard-button" data-action="back" ${state.step === 1 ? "disabled" : ""}>Tilbage</button>
          ${state.step < totalSteps
            ? `<button type="button" class="wizard-button primary" data-action="next" ${canContinue() ? "" : "disabled"}>Næste</button>`
            : `<button type="button" class="wizard-button create" data-action="create">${state.mode === "edit" ? "Gem profil og program" : "Opret program"}</button>`}
        </footer>
      </section>
    </div>`;
  }

  function close() {
    document.getElementById("profile-wizard-root")?.remove();
    state = null;
  }

  function moveTo(step) {
    state.step = Math.max(1, Math.min(totalSteps, step));
    render();
  }

  function handleClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || !state) return;
    const action = button.dataset.action;
    const value = button.dataset.value;

    if (action === "close") return close();
    if (action === "back") return moveTo(state.step - 1);
    if (action === "next" && canContinue()) return moveTo(state.step + 1);
    if (action === "program-day") {
      state.selectedProgramDay = Number(value);
      return render();
    }
    if (action === "focus") {
      state.focusAreas = state.focusAreas.includes(value)
        ? state.focusAreas.filter(area => area !== value)
        : [...state.focusAreas, value];
      state.generatedPrograms = [];
      return render();
    }
    if (action === "goal") {
      state.goal = value;
      state.generatedPrograms = [];
      return moveTo(2);
    }
    if (action === "gender") {
      state.gender = value;
      return render();
    }
    if (action === "experience") {
      state.experience = value;
      state.generatedPrograms = [];
      return moveTo(4);
    }
    if (action === "days") {
      state.trainingDaysPerWeek = Number(value);
      state.generatedPrograms = [];
      return moveTo(5);
    }
    if (action === "preference") {
      state.exercisePreference = value;
      state.generatedPrograms = [];
      return moveTo(7);
    }
    if (action === "create") {
      const programs = state.generatedPrograms.length ? state.generatedPrograms : generatePrograms();
      const profile = window.TrainingWizardStore.saveProfile({
        hasCompletedProfileWizard: true,
        goal: state.goal,
        heightCm: Number(state.heightCm),
        weightKg: Number(state.weightKg),
        age: Number(state.age),
        gender: state.gender,
        experience: state.experience,
        trainingDaysPerWeek: state.trainingDaysPerWeek,
        focusAreas: [...state.focusAreas],
        exercisePreference: state.exercisePreference
      });
      window.dispatchEvent(new CustomEvent("onboarding:create-programs", {
        detail: {
          ...profile,
          days: state.trainingDaysPerWeek,
          focus: [...state.focusAreas],
          programs: programs.map(program => ({
            title: program.title,
            goal: program.goal,
            structure: program.structure,
            exercises: program.exercises.map(exercise => ({ ...exercise }))
          }))
        }
      }));
      close();
    }
  }

  function handleInput(event) {
    if (!state || !event.target.dataset.field) return;
    state[event.target.dataset.field] = event.target.value;
    const next = document.querySelector('#profile-wizard-root [data-action="next"]');
    if (next) next.disabled = !canContinue();
  }

  function open(options = {}) {
    if (!window.TrainingWizardStore || document.getElementById("profile-wizard-root")) return;
    window.WizardUI?.ensureStyles?.();
    state = freshState(options.mode === "edit" ? "edit" : "new");
    const root = document.createElement("div");
    root.id = "profile-wizard-root";
    root.addEventListener("click", handleClick);
    root.addEventListener("input", handleInput);
    document.body.appendChild(root);
    render();
  }

  window.ProfileWizard = { open, close };
})();
