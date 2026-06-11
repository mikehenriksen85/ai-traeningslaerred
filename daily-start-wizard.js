(function dailyStartWizardModule() {
  "use strict";

  let state = null;
  let lastPepTalkIndex = -1;

  const motivations = [
    { value: "low", label: "Lav", description: "En roligere træning med mindre volumen." },
    { value: "normal", label: "Normal", description: "Følg en balanceret plan for dagen." },
    { value: "high", label: "Høj", description: "Du er klar til lidt mere arbejde i dag." }
  ];
  const actions = [
    { value: "continue", label: "Fortsæt med mit nuværende program", description: "Åbn dit senest aktive træningspas." },
    { value: "adapt", label: "Tilpas dagens træning efter min motivation", description: "Lav en dagskopi med justeret volumen, sæt og pauser." },
    { value: "generate", label: "Generér et nyt program til i dag", description: "Åbn programgeneratoren med din profil som udgangspunkt." }
  ];
  const pepTalks = [
    { title: "🚀 Dagens energi", lines: ["💪 Du har allerede vundet dagens første kamp ved at møde op.", "🔥 Hvert sæt tæller.", "🏆 Hvert valg bygger den person, du ønsker at blive."] },
    { title: "⚡ Klar til dagens mission?", lines: ["💥 Små fremskridt bliver til store resultater.", "🔥 Fremtidens dig takker dig allerede.", "💪 Lad os komme i gang."] },
    { title: "🏆 Dagens første sejr", lines: ["💪 Du valgte at investere i dig selv.", "✨ God træning begynder med et godt valg.", "🚀 Nu tager vi næste skridt sammen."] },
    { title: "🔥 Gnisten er tændt", lines: ["💪 Rolige gentagelser kan skabe stærke resultater.", "🎯 Fokus på det næste gode sæt.", "🏆 Du er præcis, hvor du skal være."] },
    { title: "💥 Stærk start", lines: ["🚀 Du har sat retningen for dagen.", "💪 Teknik, tempo og et godt humør.", "✨ Resten tager vi ét sæt ad gangen."] },
    { title: "🌟 Din tid er nu", lines: ["💪 Hver bevægelse er en investering i dig.", "🔥 Konsistens gør det stille arbejde stærkt.", "🏆 Dagens indsats tæller."] },
    { title: "🎯 Fokus fundet", lines: ["💪 Du behøver kun tage det næste skridt.", "⚡ God energi kommer også undervejs.", "🚀 Lad os bygge et solidt pas."] },
    { title: "🛠️ Vi bygger styrke", lines: ["💪 Ét godt sæt er et glimrende sted at begynde.", "🔥 Hvert gentaget valg gør vanen stærkere.", "🏆 Du er allerede i gang med arbejdet."] },
    { title: "🚦Grønt lys", lines: ["💥 Kroppen er klar til bevægelse.", "💪 Planen er klar til handling.", "🚀 Vi kører i et tempo, der passer til dig."] },
    { title: "☀️ Dagens mulighed", lines: ["✨ Et træningspas kan gøre en god dag endnu bedre.", "💪 Din indsats behøver ikke være perfekt for at virke.", "🏆 Lad os samle nogle gode gentagelser."] },
    { title: "🎵 Find rytmen", lines: ["💪 Det første sæt starter musikken.", "🔥 Stabilt tempo skaber stærke vaner.", "🚀 I dag træner vi med overskud og omtanke."] },
    { title: "🧭 Kursen er sat", lines: ["💥 Du ved, hvor du vil hen.", "💪 Hvert sæt flytter dig en lille smule.", "🏆 Små sejre er stadig ægte sejre."] },
    { title: "⚙️ Motoren starter", lines: ["💪 Vi begynder kontrolleret og bygger videre.", "🔥 God form får lov at styre tempoet.", "🚀 Dagens energi finder vi undervejs."] },
    { title: "🌱 Fremgang i arbejde", lines: ["💪 Resultater vokser af de gentagelser, du laver i dag.", "✨ Tålmodighed er også en træningsfærdighed.", "🏆 Du gør noget godt for dig selv."] },
    { title: "🥇 Klar til et godt pas", lines: ["💥 Du har allerede taget den vigtigste beslutning.", "💪 Nu gør vi træningen enkel og effektiv.", "🔥 Et sæt ad gangen."] },
    { title: "🚀 Fremad med stil", lines: ["💪 Kvalitet før hastighed.", "🔥 Energi med retning slår tilfældigt tempo.", "🏆 Lad os gøre dagens pas værd at huske."] },
    { title: "💡 Dagens påmindelse", lines: ["💪 Styrke bygges også på helt almindelige dage.", "✨ Din indsats har værdi fra første gentagelse.", "🚀 Nu giver vi kroppen noget godt at arbejde med."] },
    { title: "🌈 God energi ind", lines: ["💥 Bevægelse kan løfte mere end vægte.", "💪 Du bestemmer dagens tempo.", "🏆 Vi fejrer hvert gennemført sæt."] },
    { title: "🧱 En stærk brik mere", lines: ["💪 Hver træning lægger noget til fundamentet.", "🔥 Dagens opgave er bare at fortsætte byggeriet.", "🚀 Du har værktøjerne med dig."] },
    { title: "🎉 Træningstid", lines: ["💪 Vi tager arbejdet seriøst og humøret let.", "🔥 Gode gentagelser er dagens valuta.", "🏆 Lad os få noget stærkt ud af den."] },
    { title: "🛰️ Mission fremgang", lines: ["🚀 Destinationen er stærkere vaner.", "💪 Brændstoffet er din indsats i dag.", "✨ Kurskorrektioner er altid tilladt."] },
    { title: "🔋 Batteriet er klar", lines: ["💥 Vi bruger den energi, der er til rådighed.", "💪 Et klogt pas er altid et godt pas.", "🏆 Fremgang har mange tempoer."] },
    { title: "🎬 Dagens stærke scene", lines: ["💪 Hovedrollen er allerede mødt op.", "🔥 Rekvisitterne vejer lidt mere end normalt.", "🏆 Slutningen skriver vi ét sæt ad gangen."] },
    { title: "🪜 Næste trin", lines: ["💪 Du behøver ikke tage hele trappen på én gang.", "✨ Ét kontrolleret sæt er fin fremdrift.", "🚀 Vi fortsætter derfra."] },
    { title: "🌊 Fang rytmen", lines: ["💪 Start roligt og lad træningen finde sit flow.", "🔥 Gode bevægelser bygger god energi.", "🏆 Du styrer bølgen i dag."] },
    { title: "🔑 Nøglen er fundet", lines: ["💥 Du åbnede døren ved at vælge træningen.", "💪 Nu handler det om en god gentagelse ad gangen.", "🚀 Mulighederne står allerede åbne."] },
    { title: "🎯 Dagens fokuspunkt", lines: ["💪 Gør det næste sæt godt.", "🔥 Lad resten af programmet passe sig selv et øjeblik.", "🏆 Nærvær bygger kvalitet."] },
    { title: "🛡️ Stærk og rolig", lines: ["💪 Du kan træne målrettet uden at skynde dig.", "✨ Kontrol er en form for styrke.", "🚀 Dagens pas er klar til dig."] },
    { title: "📈 Fremgang på vej", lines: ["💥 Kurven bygges af dage som denne.", "💪 Hver gentagelse giver historien et nyt punkt.", "🏆 Du er en aktiv del af resultatet."] },
    { title: "🌟 Klar, rolig, stærk", lines: ["💪 Du møder dagen med det, du har.", "🔥 Det er mere end nok til et godt træningspas.", "🚀 Lad os skabe lidt fremdrift."] }
  ];

  function selectPepTalk() {
    let index = Math.floor(Math.random() * pepTalks.length);
    if (pepTalks.length > 1 && index === lastPepTalkIndex) {
      index = (index + 1 + Math.floor(Math.random() * (pepTalks.length - 1))) % pepTalks.length;
    }
    lastPepTalkIndex = index;
    return pepTalks[index];
  }

  function feedbackCard(pepTalk) {
    if (!pepTalk) return "";
    return `<section class="wizard-pep-talk" role="status" aria-label="Dagens motivation">
      <div class="wizard-pep-talk-kicker">Dagens pep-talk</div>
      <h3>${pepTalk.title}</h3>
      <div class="wizard-pep-talk-lines">${pepTalk.lines.map(line => `<p>${line}</p>`).join("")}</div>
    </section>`;
  }

  function showSkipFeedback() {
    document.getElementById("daily-skip-feedback")?.remove();
    const card = document.createElement("div");
    card.id = "daily-skip-feedback";
    card.className = "wizard-skip-feedback";
    card.setAttribute("role", "status");
    card.textContent = "Programmet er klar. Lad os komme i gang. 💪";
    document.body.appendChild(card);
    window.setTimeout(() => card.classList.add("show"), 20);
    window.setTimeout(() => {
      card.classList.remove("show");
      window.setTimeout(() => card.remove(), 220);
    }, 2600);
  }

  function options(list, selected, action) {
    return list.map(option => `<button type="button" class="wizard-option descriptive${selected === option.value ? " selected" : ""}" data-action="${action}" data-value="${option.value}">
      <strong>${option.label}</strong><span>${option.description}</span>
    </button>`).join("");
  }

  function render() {
    const root = document.getElementById("daily-start-wizard-root");
    if (!root || !state) return;
    const onAction = state.step === 2;
    root.innerHTML = `<div class="wizard-overlay daily" role="dialog" aria-modal="true" aria-labelledby="daily-wizard-title">
      <section class="wizard-panel daily-panel">
        <header class="wizard-head">
          <div class="wizard-head-row">
            <div class="wizard-title" id="daily-wizard-title">Dagens træning</div>
            <button type="button" class="wizard-close" data-action="close" aria-label="Luk">×</button>
          </div>
          <div class="wizard-progress"><span style="width:${onAction ? 100 : 50}%"></span></div>
          <div class="wizard-progress-meta"><span>Trin ${state.step} af 2</span><span>${onAction ? 100 : 50}%</span></div>
        </header>
        <div class="wizard-content">
          ${onAction
            ? `<h2 class="wizard-step-title">Hvad ønsker du at gøre i dag?</h2>
               ${feedbackCard(state.pepTalk)}
               <div class="wizard-options single-column">${options(actions, state.selectedAction, "daily-action")}</div>`
            : `<h2 class="wizard-step-title">Hvordan er din motivation i dag?</h2>
               <p class="wizard-help">Dit svar bruges kun til dagens forslag.</p>
               <div class="wizard-options">${options(motivations, state.motivation, "motivation")}</div>`}
        </div>
        <footer class="wizard-footer">
          <button type="button" class="wizard-button" data-action="back" ${state.step === 1 ? "disabled" : ""}>Tilbage</button>
          <button type="button" class="wizard-button" data-action="skip">Spring over</button>
        </footer>
      </section>
    </div>`;
  }

  function close() {
    document.getElementById("daily-start-wizard-root")?.remove();
    state = null;
  }

  function finish(action) {
    window.TrainingWizardStore?.saveDailyState?.({
      motivation: state.motivation,
      selectedAction: action
    });
    window.dispatchEvent(new CustomEvent(`daily-wizard:${action}`, {
      detail: { motivation: state.motivation }
    }));
    close();
  }

  function handleClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || !state) return;
    const action = button.dataset.action;
    if (action === "close") return close();
    if (action === "skip") {
      close();
      showSkipFeedback();
      return;
    }
    if (action === "back") {
      state.step = 1;
      return render();
    }
    if (action === "motivation") {
      state.motivation = button.dataset.value;
      state.pepTalk = selectPepTalk();
      state.step = 2;
      return render();
    }
    if (action === "daily-action") finish(button.dataset.value);
  }

  function open() {
    if (!window.TrainingWizardStore || document.getElementById("daily-start-wizard-root")) return;
    window.WizardUI?.ensureStyles?.();
    state = {
      step: 1,
      motivation: window.TrainingWizardStore.getDailyState().motivation || "normal",
      pepTalk: null,
      selectedAction: ""
    };
    const root = document.createElement("div");
    root.id = "daily-start-wizard-root";
    root.addEventListener("click", handleClick);
    document.body.appendChild(root);
    render();
  }

  window.DailyStartWizard = { open, close };
})();
