(function onboardingWizardModule() {
  "use strict";

  if (window.ENABLE_ONBOARDING_WIZARD !== true) return;

  const state = {
    step: 1,
    goal: "",
    height: "",
    weight: "",
    age: "",
    experience: "",
    days: 3,
    focus: [],
    selectedProgramDay: 0,
    generatedPrograms: []
  };

  const totalSteps = 6;
  const goals = ["Muskelopbygning", "Vægttab", "Styrke", "Generel sundhed"];
  const experienceLevels = ["Nybegynder", "Let øvet", "Øvet", "Erfaren"];
  const focusAreas = ["Bryst", "Skuldre", "Arme", "Ben", "Core", "Ryg"];
  const exercisePools = {
    Bryst: [
      { name: "Barbell Bench Press", muscle: "Bryst" },
      { name: "Incline Dumbbell Press", muscle: "Bryst" },
      { name: "Machine Chest Press", muscle: "Bryst" },
      { name: "Cable Fly", muscle: "Bryst" },
      { name: "Weighted Push-ups", muscle: "Bryst" },
      { name: "Chest Dips", muscle: "Bryst" }
    ],
    Skuldre: [
      { name: "Overhead Press", muscle: "Skuldre" },
      { name: "Dumbbell Shoulder Press", muscle: "Skuldre" },
      { name: "Arnold Press", muscle: "Skuldre" },
      { name: "Lateral Raise", muscle: "Skuldre" },
      { name: "Cable Lateral Raise", muscle: "Skuldre" },
      { name: "Rear Delt Fly", muscle: "Skuldre" }
    ],
    Arme: [
      { name: "Barbell Curl", muscle: "Biceps" },
      { name: "Hammer Curl", muscle: "Biceps" },
      { name: "Incline Dumbbell Curl", muscle: "Biceps" },
      { name: "Cable Triceps Pushdown", muscle: "Triceps" },
      { name: "Overhead Cable Extension", muscle: "Triceps" },
      { name: "Skull Crusher", muscle: "Triceps" }
    ],
    Ben: [
      { name: "Back Squat", muscle: "Forside lår" },
      { name: "Leg Press", muscle: "Forside lår" },
      { name: "Bulgarian Split Squat", muscle: "Forside lår" },
      { name: "Romanian Deadlift", muscle: "Bagside lår & baller" },
      { name: "Hip Thrust", muscle: "Bagside lår & baller" },
      { name: "Seated Leg Curl", muscle: "Bagside lår & baller" }
    ],
    Core: [
      { name: "Plank", muscle: "Mave" },
      { name: "Dead Bug", muscle: "Mave" },
      { name: "Ab Wheel Rollout", muscle: "Mave" },
      { name: "Cable Crunch", muscle: "Mave" },
      { name: "Pallof Press", muscle: "Mave" },
      { name: "Bird Dog", muscle: "Nedre ryg / lænd" }
    ],
    Ryg: [
      { name: "Pull-ups", muscle: "Øvre ryg" },
      { name: "Lat Pulldown", muscle: "Øvre ryg" },
      { name: "Chest-Supported Row", muscle: "Øvre ryg" },
      { name: "Barbell Row", muscle: "Øvre ryg" },
      { name: "Seated Cable Row", muscle: "Øvre ryg" },
      { name: "One-Arm Dumbbell Row", muscle: "Øvre ryg" }
    ]
  };

  function injectStyles() {
    const style = document.createElement("style");
    style.id = "onboarding-wizard-styles";
    style.textContent = `
      .onboarding-overlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(10, 14, 18, .78);
        font-family: var(--font-primary, "Segoe UI", Arial, sans-serif);
        color: var(--text-primary, #fff);
      }
      .onboarding-panel {
        width: min(620px, 100%);
        max-height: min(760px, 94vh);
        overflow-y: auto;
        background: var(--card, #252e36);
        border: 1px solid var(--border, #313d49);
        border-radius: 8px;
        box-shadow: 0 22px 60px rgba(0, 0, 0, .46);
      }
      .onboarding-head { padding: 18px 18px 14px; border-bottom: 1px solid var(--border, #313d49); }
      .onboarding-head-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .onboarding-title { font-size: var(--font-size-h2, 1.125rem); font-weight: var(--font-weight-bold, 700); line-height: var(--line-height-heading, 1.25); }
      .onboarding-close {
        width: 32px;
        height: 32px;
        border: 1px solid var(--border, #313d49);
        border-radius: 5px;
        background: var(--input, #1a2026);
        color: var(--text-secondary, #a0aab2);
        cursor: pointer;
      }
      .onboarding-progress-track { height: 6px; margin-top: 14px; overflow: hidden; border-radius: 3px; background: rgba(255, 255, 255, .09); }
      .onboarding-progress-fill { height: 100%; width: 0; border-radius: 3px; background: var(--blue, #3a93ff); transition: width .2s ease; }
      .onboarding-progress-meta { display: flex; justify-content: space-between; margin-top: 7px; color: var(--text-secondary, #a0aab2); font-size: var(--font-size-small, .75rem); }
      .onboarding-content { padding: 22px 18px; }
      .onboarding-step-title { margin: 0 0 7px; font-size: var(--font-size-h1, 1.5rem); font-weight: var(--font-weight-bold, 700); line-height: var(--line-height-heading, 1.25); }
      .onboarding-help { margin: 0 0 18px; color: var(--text-secondary, #a0aab2); font-size: var(--font-size-body, .875rem); line-height: var(--line-height-body, 1.5); }
      .onboarding-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .onboarding-option {
        min-height: 48px;
        padding: 11px;
        border: 1px solid var(--border, #313d49);
        border-radius: 6px;
        background: var(--input, #1a2026);
        color: var(--text-primary, #fff);
        font: inherit;
        font-weight: var(--font-weight-semibold, 600);
        cursor: pointer;
      }
      .onboarding-option.selected { color: var(--green, #4ade80); border-color: var(--green, #4ade80); background: rgba(74, 222, 128, .09); }
      .onboarding-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .onboarding-field label { display: block; margin-bottom: 5px; color: var(--text-secondary, #a0aab2); font-size: var(--font-size-small, .75rem); }
      .onboarding-field input {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--border, #313d49);
        border-radius: 6px;
        outline: none;
        background: var(--input, #1a2026);
        color: var(--text-primary, #fff);
        font: inherit;
      }
      .onboarding-field input:focus { border-color: var(--blue, #3a93ff); }
      .onboarding-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; }
      .onboarding-summary { display: grid; gap: 10px; }
      .onboarding-summary-card { padding: 12px; border: 1px solid var(--border, #313d49); border-radius: 6px; background: rgba(0, 0, 0, .14); }
      .onboarding-summary-card span { display: block; color: var(--text-secondary, #a0aab2); font-size: var(--font-size-small, .75rem); }
      .onboarding-summary-card strong { display: block; margin-top: 3px; font-size: var(--font-size-h3, 1rem); }
      .onboarding-program { display: grid; gap: 7px; margin-top: 12px; }
      .onboarding-program-tabs { display: flex; gap: 7px; overflow-x: auto; margin-top: 14px; padding-bottom: 3px; }
      .onboarding-program-tab {
        flex: 0 0 auto;
        padding: 8px 11px;
        border: 1px solid var(--border, #313d49);
        border-radius: 5px;
        background: var(--input, #1a2026);
        color: var(--text-secondary, #a0aab2);
        font: inherit;
        font-weight: var(--font-weight-semibold, 600);
        cursor: pointer;
      }
      .onboarding-program-tab.selected { color: var(--green, #4ade80); border-color: var(--green, #4ade80); }
      .onboarding-program-row { display: flex; justify-content: space-between; gap: 12px; padding: 9px 10px; border-bottom: 1px solid rgba(255, 255, 255, .06); }
      .onboarding-program-row span:last-child { color: var(--text-secondary, #a0aab2); white-space: nowrap; }
      .onboarding-message { display: none; margin-top: 12px; color: var(--green, #4ade80); font-weight: var(--font-weight-semibold, 600); }
      .onboarding-message.show { display: block; }
      .onboarding-footer { display: flex; justify-content: space-between; gap: 10px; padding: 14px 18px 18px; border-top: 1px solid var(--border, #313d49); }
      .onboarding-button {
        min-width: 105px;
        padding: 10px 15px;
        border-radius: 6px;
        border: 1px solid var(--border, #313d49);
        background: var(--input, #1a2026);
        color: var(--text-primary, #fff);
        font: inherit;
        font-weight: var(--font-weight-semibold, 600);
        cursor: pointer;
      }
      .onboarding-button.primary { border-color: var(--blue, #3a93ff); background: var(--blue, #3a93ff); }
      .onboarding-button.create { border-color: var(--green, #4ade80); background: var(--green, #4ade80); color: #102117; }
      .onboarding-button:disabled { cursor: not-allowed; opacity: .45; }
      @media (max-width: 560px) {
        .onboarding-overlay { padding: 10px; }
        .onboarding-options, .onboarding-fields { grid-template-columns: 1fr; }
        .onboarding-days { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  function optionButtons(options, selected, action, multiple) {
    return options.map(option => {
      const active = multiple ? selected.includes(option) : selected === option;
      return `<button type="button" class="onboarding-option${active ? " selected" : ""}" data-action="${action}" data-value="${option}">${option}</button>`;
    }).join("");
  }

  function programSets() {
    if (state.experience === "Nybegynder") return 2;
    if (state.experience === "Erfaren") return 4;
    return 3;
  }

  function exercisesPerDay() {
    if (state.days <= 2) return 7;
    if (state.days <= 4) return 6;
    return 5;
  }

  function orderedFocusAreas() {
    const selected = state.focus.length ? state.focus : ["Bryst", "Ryg", "Ben", "Core"];
    const support = ["Bryst", "Ryg", "Ben", "Skuldre", "Arme", "Core"];
    return [...selected, ...support.filter(area => !selected.includes(area))];
  }

  function generatePrograms() {
    const focus = orderedFocusAreas();
    const pools = Object.fromEntries(Object.entries(exercisePools).map(([area, exercises]) => [area, [...exercises]]));
    const used = new Set();
    const count = exercisesPerDay();
    const sets = programSets();
    const programs = [];

    for (let day = 0; day < state.days; day++) {
      const exercises = [];
      for (let slot = 0; slot < count; slot++) {
        const startArea = (day * 2 + slot) % focus.length;
        let selectedExercise = null;
        for (let offset = 0; offset < focus.length && !selectedExercise; offset++) {
          const area = focus[(startArea + offset) % focus.length];
          const candidate = pools[area]?.find(exercise => !used.has(exercise.name));
          if (candidate) selectedExercise = candidate;
        }
        if (!selectedExercise) {
          const allExercises = Object.values(exercisePools).flat();
          selectedExercise = allExercises.find(exercise => !exercises.some(item => item.name === exercise.name)) || allExercises[(day + slot) % allExercises.length];
        }
        used.add(selectedExercise.name);
        exercises.push({ ...selectedExercise, sets });
      }
      const primaryAreas = [...new Set(exercises.map(exercise => exercise.muscle))].slice(0, 2);
      programs.push({
        title: `Dag ${day + 1}: ${primaryAreas.join(" & ")}`,
        exercises
      });
    }
    state.generatedPrograms = programs;
    state.selectedProgramDay = Math.min(state.selectedProgramDay, programs.length - 1);
    return programs;
  }

  function estimatedMinutes(exercises) {
    const setCount = exercises.reduce((sum, item) => sum + item.sets, 0);
    return Math.ceil((setCount * 45 + Math.max(0, setCount - exercises.length) * 90 + Math.max(0, exercises.length - 1) * 90) / 60);
  }

  function stepHtml() {
    if (state.step === 1) {
      return `<h2 class="onboarding-step-title">Hvad er dit vigtigste mål?</h2><p class="onboarding-help">Vælg det mål, som bedst beskriver dit fokus lige nu.</p><div class="onboarding-options">${optionButtons(goals, state.goal, "goal", false)}</div>`;
    }
    if (state.step === 2) {
      return `
        <h2 class="onboarding-step-title">Fortæl lidt om dig</h2>
        <p class="onboarding-help">Oplysningerne bruges kun i denne prototype og bliver ikke gemt.</p>
        <div class="onboarding-fields">
          <div class="onboarding-field"><label for="onboarding-height">Højde (cm)</label><input id="onboarding-height" data-field="height" type="number" min="50" value="${state.height}"></div>
          <div class="onboarding-field"><label for="onboarding-weight">Vægt (kg)</label><input id="onboarding-weight" data-field="weight" type="number" min="1" step="0.1" value="${state.weight}"></div>
          <div class="onboarding-field"><label for="onboarding-age">Alder</label><input id="onboarding-age" data-field="age" type="number" min="13" max="100" value="${state.age}"></div>
        </div>`;
    }
    if (state.step === 3) {
      return `<h2 class="onboarding-step-title">Hvad er dit erfaringsniveau?</h2><p class="onboarding-help">Det hjælper med at tilpasse antal sæt og programmets kompleksitet.</p><div class="onboarding-options">${optionButtons(experienceLevels, state.experience, "experience", false)}</div>`;
    }
    if (state.step === 4) {
      return `<h2 class="onboarding-step-title">Hvor ofte vil du træne?</h2><p class="onboarding-help">Vælg antal træningsdage pr. uge.</p><div class="onboarding-days">${optionButtons(["1", "2", "3", "4", "5", "6", "7"], String(state.days), "days", false)}</div>`;
    }
    if (state.step === 5) {
      return `<h2 class="onboarding-step-title">Vælg fokusområder</h2><p class="onboarding-help">Du kan vælge flere områder.</p><div class="onboarding-options">${optionButtons(focusAreas, state.focus, "focus", true)}</div>`;
    }
    const programs = state.generatedPrograms.length === state.days ? state.generatedPrograms : generatePrograms();
    const program = programs[state.selectedProgramDay] || programs[0];
    return `
      <h2 class="onboarding-step-title">Dit AI-forslag</h2>
      <p class="onboarding-help">Der er lavet ét forskelligt træningspas til hver af dine ${state.days} træningsdage.</p>
      <div class="onboarding-summary">
        <div class="onboarding-summary-card"><span>Mål og niveau</span><strong>${state.goal || "Generel sundhed"} · ${state.experience || "Nybegynder"}</strong></div>
        <div class="onboarding-summary-card"><span>Træningsplan</span><strong>${state.days} forskellige pas · Estimeret tid pr. pas: ${estimatedMinutes(program.exercises)} min</strong></div>
      </div>
      <div class="onboarding-program-tabs">${programs.map((item, index) => `<button type="button" class="onboarding-program-tab${index === state.selectedProgramDay ? " selected" : ""}" data-action="program-day" data-value="${index}">Dag ${index + 1}</button>`).join("")}</div>
      <div class="onboarding-program">${program.exercises.map((item, index) => `<div class="onboarding-program-row"><span>${index + 1}. ${item.name}</span><span>${item.sets} sæt</span></div>`).join("")}</div>
      <div class="onboarding-message" id="onboarding-message">${state.days} træningspas er oprettet og gemt under Gemte Træningspas.</div>`;
  }

  function canContinue() {
    if (state.step === 1) return Boolean(state.goal);
    if (state.step === 2) return Number(state.height) > 0 && Number(state.weight) > 0 && Number(state.age) >= 13;
    if (state.step === 3) return Boolean(state.experience);
    if (state.step === 4) return Number(state.days) > 0;
    if (state.step === 5) return state.focus.length > 0;
    return true;
  }

  function render() {
    const root = document.getElementById("onboarding-wizard-root");
    if (!root) return;
    const progress = Math.round((state.step / totalSteps) * 100);
    root.innerHTML = `
      <div class="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <section class="onboarding-panel">
          <header class="onboarding-head">
            <div class="onboarding-head-row">
              <div class="onboarding-title" id="onboarding-title">Kom godt i gang</div>
              <button type="button" class="onboarding-close" data-action="close" aria-label="Luk onboarding">×</button>
            </div>
            <div class="onboarding-progress-track"><div class="onboarding-progress-fill" style="width:${progress}%"></div></div>
            <div class="onboarding-progress-meta"><span>Trin ${state.step} af ${totalSteps}</span><span>${progress}%</span></div>
          </header>
          <div class="onboarding-content">${stepHtml()}</div>
          <footer class="onboarding-footer">
            <button type="button" class="onboarding-button" data-action="back" ${state.step === 1 ? "disabled" : ""}>Tilbage</button>
            ${state.step < totalSteps
              ? `<button type="button" class="onboarding-button primary" data-action="next" ${canContinue() ? "" : "disabled"}>Næste</button>`
              : `<button type="button" class="onboarding-button create" data-action="create">Opret træningsprogram</button>`}
          </footer>
        </section>
      </div>`;
  }

  function closeWizard() {
    document.getElementById("onboarding-wizard-root")?.remove();
    document.getElementById("onboarding-wizard-styles")?.remove();
  }

  function handleClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const value = button.dataset.value;
    if (action === "close") return closeWizard();
    if (action === "back" && state.step > 1) state.step -= 1;
    if (action === "next" && canContinue() && state.step < totalSteps) state.step += 1;
    if (action === "goal") {
      state.goal = value;
      state.generatedPrograms = [];
      state.step = 2;
    }
    if (action === "experience") {
      state.experience = value;
      state.generatedPrograms = [];
      state.step = 4;
    }
    if (action === "days") {
      state.days = Number(value);
      state.generatedPrograms = [];
      state.step = 5;
    }
    if (action === "focus") {
      state.focus = state.focus.includes(value) ? state.focus.filter(item => item !== value) : [...state.focus, value];
      state.generatedPrograms = [];
    }
    if (action === "program-day") {
      state.selectedProgramDay = Number(value);
    }
    if (action === "create") {
      const programs = state.generatedPrograms.length === state.days ? state.generatedPrograms : generatePrograms();
      window.dispatchEvent(new CustomEvent("onboarding:create-programs", {
        detail: {
          goal: state.goal,
          experience: state.experience,
          days: state.days,
          focus: [...state.focus],
          programs: programs.map(program => ({
            title: program.title,
            exercises: program.exercises.map(exercise => ({ ...exercise }))
          }))
        }
      }));
      document.getElementById("onboarding-message")?.classList.add("show");
      window.setTimeout(closeWizard, 1800);
      return;
    }
    render();
  }

  function handleInput(event) {
    const field = event.target.dataset.field;
    if (!field) return;
    state[field] = event.target.value;
    const nextButton = document.querySelector('#onboarding-wizard-root [data-action="next"]');
    if (nextButton) nextButton.disabled = !canContinue();
  }

  function mount() {
    if (document.getElementById("onboarding-wizard-root")) return;
    injectStyles();
    const root = document.createElement("div");
    root.id = "onboarding-wizard-root";
    root.addEventListener("click", handleClick);
    root.addEventListener("input", handleInput);
    document.body.appendChild(root);
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
