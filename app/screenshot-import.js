(function screenshotImportModule() {
  "use strict";

  const OCR_SCRIPT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const MAX_FILE_BYTES = 12 * 1024 * 1024;
  const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/bmp"]);
  let state = createState();
  let scriptPromise = null;

  function defaultNewExerciseSetCount() {
    return Math.max(1, Number(window.Work4itDefaults?.newExerciseSetCount) || 1);
  }

  function createState() {
    return {
      file: null,
      previewUrl: "",
      progress: 0,
      status: "Vælg et billede for at begynde.",
      rawText: "",
      ocrConfidence: 0,
      result: null,
      processing: false
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function loadOcrLibrary() {
    if (window.Tesseract?.createWorker) return Promise.resolve(window.Tesseract);
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = OCR_SCRIPT;
      script.crossOrigin = "anonymous";
      script.onload = () => window.Tesseract?.createWorker
        ? resolve(window.Tesseract)
        : reject(new Error("OCR-biblioteket blev indlæst uden den forventede funktion."));
      script.onerror = () => reject(new Error("OCR kunne ikke indlæses. Kontrollér internetforbindelsen."));
      document.head.appendChild(script);
    });
    return scriptPromise;
  }

  function normalizeLine(line) {
    return String(line || "")
      .replace(/[|]/g, " ")
      .replace(/[–—]/g, "-")
      .replace(/[×]/g, "x")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeToken(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\b(barbell|dumbbell|machine|cable|bodyweight|kettlebell|smith|håndvægt|haandvaegt|vægtstang|vaegtstang|maskine|kabel)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getCatalog() {
    const catalog = window.Work4itExerciseCatalog || window.work4itExerciseCatalog || [];
    return Array.isArray(catalog) ? catalog.filter(exercise => exercise?.name) : [];
  }

  function levenshtein(a, b) {
    const left = normalizeToken(a);
    const right = normalizeToken(b);
    if (!left || !right) return Math.max(left.length, right.length);
    const dp = Array.from({ length: left.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= right.length; j++) dp[0][j] = j;
    for (let i = 1; i <= left.length; i++) {
      for (let j = 1; j <= right.length; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
        );
      }
    }
    return dp[left.length][right.length];
  }

  function exerciseAliases(name) {
    const normalized = normalizeToken(name);
    const aliases = {
      "bench press": "Barbell Bench Press",
      "bench press barbell": "Barbell Bench Press",
      "barbell bench press": "Barbell Bench Press",
      "baenkpres": "Barbell Bench Press",
      "dumbbell bench press": "Dumbbell Bench Press",
      "incline press": "Incline Barbell Bench Press",
      "squat": "Back Squat",
      "back squat": "Back Squat",
      "front squat": "Front Squat",
      "deadlift": "Deadlift",
      "romanian deadlift": "Romanian Deadlift",
      "rdl": "Romanian Deadlift",
      "lat pulldown": "Lat Pulldown",
      "pull up": "Pull-up",
      "pullup": "Pull-up",
      "pull ups": "Pull-up",
      "row": "Barbell Row",
      "barbell row": "Barbell Row",
      "seated row": "Seated Cable Row",
      "shoulder press": "Overhead Press",
      "overhead press": "Overhead Press",
      "bicep curl": "Barbell Curl",
      "biceps curl": "Barbell Curl",
      "triceps pushdown": "Cable Triceps Pushdown",
      "pushdown": "Cable Triceps Pushdown",
      "leg press": "Leg Press",
      "leg extension": "Leg Extension",
      "leg curl": "Lying Leg Curl",
      "running": "Udendørs løb",
      "run": "Udendørs løb",
      "treadmill": "Løbebånd",
      "bike": "Motionscykel",
      "rowing": "Romaskine"
    };
    return aliases[normalized] || "";
  }

  function matchExerciseName(rawName) {
    const catalog = getCatalog();
    const cleaned = cleanExerciseName(rawName);
    if (!cleaned) {
      return { inputName: rawName || "", matchedName: "", muscle: "", confidence: 0, status: "missing", suggestions: [] };
    }
    const alias = exerciseAliases(cleaned);
    const candidateName = alias || cleaned;
    const normalized = normalizeToken(candidateName);
    const scored = catalog.map(exercise => {
      const exerciseName = normalizeToken(exercise.name);
      let score = 0;
      if (exerciseName === normalized) score = 100;
      else if (exerciseName.includes(normalized) || normalized.includes(exerciseName)) score = 88;
      else {
        const distance = levenshtein(normalized, exerciseName);
        const longest = Math.max(normalized.length, exerciseName.length, 1);
        score = Math.max(0, Math.round((1 - distance / longest) * 100));
      }
      return { exercise, score };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0];
    const suggestions = scored.slice(0, 5).filter(item => item.score >= 45).map(item => ({
      name: item.exercise.name,
      muscle: item.exercise.muscle,
      confidence: item.score
    }));
    if (!best || best.score < 62) {
      return {
        inputName: cleaned,
        matchedName: "",
        muscle: "",
        confidence: best?.score || 0,
        status: "needs_review",
        suggestions
      };
    }
    return {
      inputName: cleaned,
      matchedName: best.exercise.name,
      muscle: best.exercise.muscle,
      confidence: best.score,
      status: best.score >= 88 ? "matched" : "suggested",
      suggestions
    };
  }

  function cleanExerciseName(line) {
    return normalizeLine(line)
      .replace(/^\s*[-•●▪✓]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .replace(/^\d+\s*(?:x|×)\s*/i, "")
      .replace(/\b\d+\s*(?:x|×)\s*\d+(?:\s*[-–]\s*\d+)?\b.*$/i, "")
      .replace(/\b\d+\s*(?:sæt|sets?)\b.*$/i, "")
      .replace(/\b(?:pause|rest)\s*[:=]?\s*\d+(?::\d{2})?\s*(?:sek|sec|s|min)?\b.*$/i, "")
      .replace(/\b(?:barbell|dumbbell|machine|cable|bodyweight)\b/ig, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[:;,.-]+$/, "")
      .trim();
  }

  function parsePause(line) {
    const explicit = line.match(/\b(?:pause|rest)\s*[:=]?\s*(\d+)(?::(\d{2}))?\s*(min|m|sek|sec|s)?\b/i);
    if (!explicit) return "";
    let seconds = Number(explicit[1]);
    if (explicit[2]) seconds = seconds * 60 + Number(explicit[2]);
    else if (/^(min|m)$/i.test(explicit[3] || "")) seconds *= 60;
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function parsePrescription(line) {
    const leadingSets = line.match(/^\s*(\d{1,2})\s*x\s*([a-zæøåäöü][a-zæøåäöü0-9 '\-/()]{2,80})$/i);
    const compact = line.match(/\b(\d{1,2})\s*x\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\b/i);
    const words = line.match(/\b(\d{1,2})\s*(?:sæt|sets?)\D{0,12}(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*(?:reps?|gentagelser?)?\b/i);
    const table = line.match(/^([a-zæøåäöü][a-zæøåäöü '\-/]{2,50}?)\s+(\d{1,2})\s+(\d{1,3}(?:\s*[-–]\s*\d{1,3})?)\s*(?:reps?)?(?:\s+(\d+(?:[.,]\d+)?)\s*kg)?(?:\s+(\d+(?::\d{2})?)\s*(?:sec|sek|s|min)?)?$/i);
    const match = compact || words;
    const weightMatch = line.match(/\b(\d+(?:[.,]\d+)?)\s*kg\b/i);
    const tableReps = table?.[3]?.replace(/\s+/g, "") || "";
    return {
      name: leadingSets?.[2]?.trim() || table?.[1]?.trim() || "",
      setCount: leadingSets ? Math.max(1, Math.min(20, Number(leadingSets[1]))) : match ? Math.max(1, Math.min(20, Number(match[1]))) : table ? Number(table[2]) : null,
      reps: match ? `${match[2]}${match[3] ? `-${match[3]}` : ""}` : tableReps,
      weight: weightMatch ? weightMatch[1].replace(",", ".") : table?.[4]?.replace(",", ".") || "",
      pause: parsePause(line) || (table?.[5] ? `${String(Math.floor(Number(table[5]) / 60)).padStart(2, "0")}:${String(Number(table[5]) % 60).padStart(2, "0")}` : "")
    };
  }

  function looksLikeNoise(line) {
    return !line
      || /^(workout|træning|program|exercise|øvelse|sets?|sæt|reps?|kg|weight|vægt|rest|pause|notes?|noter?|done|færdig)$/i.test(line)
      || /^(hevy|strong|fitbod)$/i.test(line)
      || /^(exercise|øvelse)\b.*\b(sets?|sæt|reps?|gentagelser)\b/i.test(line)
      || /\b(?:days?|dage|weeks?|uger|months?|måneder)\s+ago\b/i.test(line)
      || /\b(?:search|søg|filter|sort|edit|rediger|save|gem|cancel|annuller|share|del|profile|profil|settings|indstillinger|home|hjem|dashboard|history|historik)\b/i.test(line)
      || /^(mon|tue|wed|thu|fri|sat|sun|man|tir|ons|tor|fre|lør|søn)\b/i.test(line)
      || /^(wifi|bluetooth|battery|batteri|notification|notifikation|menu|navigation|nav|back|tilbage)$/i.test(line)
      || /^[<>{}()[\]_=+~^*#@]{1,}$/.test(line)
      || /^\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?$/.test(line)
      || /^\d{1,3}%$/.test(line)
      || /^\d{1,2}[:.]\d{2}$/.test(line)
      || line.length < 3;
  }

  function dayHeading(line) {
    const match = line.match(/^(?:dag|day|mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*([0-9]*)\s*[:.-]?\s*(.*)$/i);
    if (!match) return null;
    const suffix = match[2]?.trim();
    return suffix ? `${line.split(/[:.-]/)[0].trim()}: ${suffix}` : line.trim();
  }

  function lineCouldBeExercise(line) {
    const name = cleanExerciseName(line);
    if (looksLikeNoise(name)) return false;
    if (/^\d+(?:[.,]\d+)?\s*(?:kg|lbs?)?$/i.test(name)) return false;
    if (/^(?:pause|rest)\b/i.test(name)) return false;
    if (/^(total|duration|varighed|volume|volumen|calories|kalorier|date|dato|start|finish|afslut|completed|progress)\b/i.test(name)) return false;
    if (/^(add|tilføj|new|ny)\s+(exercise|øvelse|workout|træning)/i.test(name)) return false;
    return /[a-zæøåäöü]/i.test(name) && name.length <= 80;
  }

  function exerciseWarnings(exercise, confidence) {
    return [
      exercise.setCountInferred ? "Sæt mangler - Work4it bruger 3 som standard, kontrollér feltet." : "",
      !exercise.reps ? "Reps mangler." : "",
      !exercise.pause ? "Pause mangler." : "",
      exercise.matchStatus !== "matched" ? "Øvelsesmatch kræver kontrol." : "",
      confidence < 75 ? "OCR-sikkerheden er lav." : ""
    ].filter(Boolean);
  }

  function parseOcrText(text, confidence = 0) {
    const lines = String(text || "").split(/\r?\n/).map(normalizeLine).filter(Boolean);
    const meaningful = lines.filter(line => !looksLikeNoise(line));
    const titleCandidate = meaningful.find(line => !dayHeading(line) && !/\b\d+\s*(?:x|×)\s*\d+\b/.test(line));
    const result = {
      programName: titleCandidate && titleCandidate.length <= 70 ? cleanExerciseName(titleCandidate) : "Importeret træningspas",
      title: titleCandidate && titleCandidate.length <= 70 ? cleanExerciseName(titleCandidate) : "Importeret træningspas",
      confidence: Math.round(Number(confidence) || 0),
      days: [],
      warnings: []
    };
    let currentDay = { title: "Dag 1", exercises: [] };
    result.days.push(currentDay);
    let pendingExercise = null;

    lines.forEach((line, index) => {
      const heading = dayHeading(line);
      if (heading) {
        if (currentDay.exercises.length || result.days.length === 1 && currentDay.title !== "Dag 1") {
          currentDay = { title: heading, exercises: [] };
          result.days.push(currentDay);
        } else {
          currentDay.title = heading;
        }
        pendingExercise = null;
        return;
      }

      const prescription = parsePrescription(line);
      const hasPrescription = prescription.setCount || prescription.reps || prescription.weight || prescription.pause;
      const name = prescription.name || cleanExerciseName(line);
      const isTitle = index === lines.indexOf(titleCandidate) && name === result.title;

      if (pendingExercise && hasPrescription && !prescription.name) {
        if (prescription.setCount) {
          pendingExercise.setCount = prescription.setCount;
          pendingExercise.setCountInferred = false;
        }
        if (prescription.reps) pendingExercise.reps = prescription.reps;
        if (prescription.weight) pendingExercise.weight = prescription.weight;
        if (prescription.pause) pendingExercise.pause = prescription.pause;
        pendingExercise.uncertain = confidence < 75 || !pendingExercise.reps || pendingExercise.matchStatus !== "matched";
        pendingExercise.warnings = exerciseWarnings(pendingExercise, confidence);
        return;
      }

      if (lineCouldBeExercise(line) && !isTitle && (hasPrescription || !/^\d/.test(line))) {
        const match = matchExerciseName(name);
        const exercise = {
          originalName: name,
          name: match.matchedName || name,
          matchedName: match.matchedName,
          muscle: match.muscle,
          matchConfidence: match.confidence,
          matchStatus: match.status,
          matchSuggestions: match.suggestions,
          setCount: prescription.setCount || defaultNewExerciseSetCount(),
          setCountInferred: !prescription.setCount,
          reps: prescription.reps || "",
          weight: prescription.weight,
          pause: prescription.pause || "",
          notes: "",
          uncertain: confidence < 75 || !prescription.setCount || !prescription.reps || match.status !== "matched",
        };
        exercise.warnings = exerciseWarnings(exercise, confidence);
        currentDay.exercises.push(exercise);
        pendingExercise = exercise;
        return;
      }

      if (pendingExercise && hasPrescription) {
        if (prescription.setCount) pendingExercise.setCount = prescription.setCount;
        if (prescription.reps) pendingExercise.reps = prescription.reps;
        if (prescription.weight) pendingExercise.weight = prescription.weight;
        if (prescription.pause) pendingExercise.pause = prescription.pause;
        pendingExercise.uncertain = confidence < 75 || !pendingExercise.reps || pendingExercise.matchStatus !== "matched";
        return;
      }

      if (pendingExercise && /^(note|noter?|bemærkning)\s*:/i.test(line)) {
        pendingExercise.notes = line.replace(/^[^:]+:\s*/, "");
      }
    });

    result.days = result.days.filter(day => day.exercises.length);
    if (!result.days.length) {
      result.days = [{ title: "Dag 1", exercises: [] }];
      result.warnings.push("Ingen sikre øvelser blev fundet. Kontrollér billedets skarphed eller redigér OCR-teksten.");
    }
    if (result.confidence < 75) result.warnings.push("OCR-sikkerheden er lav. Kontrollér de markerede felter.");
    if (result.days.some(day => day.exercises.some(exercise => exercise.uncertain))) {
      result.warnings.push("Nogle sæt eller reps kunne ikke aflæses sikkert.");
    }
    if (result.days.some(day => day.exercises.some(exercise => exercise.warnings?.length))) {
      result.warnings.push("Nogle felter mangler eller kræver kontrol i previewet.");
    }
    if (result.days.some(day => day.exercises.some(exercise => exercise.matchStatus !== "matched"))) {
      result.warnings.push("Nogle øvelser kræver manuelt match mod Work4its øvelsesdatabase.");
    }
    return result;
  }

  function renderUpload() {
    const content = document.getElementById("modalContent");
    if (!content) return;
    content.innerHTML = `
      <div class="screenshot-import">
        <div class="screenshot-drop" id="screenshotDropZone">
          <input id="screenshotFile" type="file" accept="image/png,image/jpeg,image/webp,image/bmp" hidden>
          <div class="screenshot-drop-icon">📷</div>
          <h3>Upload dit træningsprogram</h3>
          <p>Understøtter screenshots og billeder fra Hevy, Strong, Fitbod, Excel og PDF-visninger.</p>
          <button class="small-btn" type="button" id="screenshotChooseBtn">Vælg billede</button>
        </div>
        <p class="screenshot-privacy">Billedet analyseres lokalt i browseren og gemmes ikke som billedfil.</p>
        <div class="screenshot-file-summary" id="screenshotFileSummary" hidden></div>
        <div class="screenshot-progress" id="screenshotProgress" hidden>
          <div class="screenshot-progress-track"><span id="screenshotProgressFill"></span></div>
          <span id="screenshotProgressText">0%</span>
        </div>
        <p class="helper-text" id="screenshotStatus">${escapeHtml(state.status)}</p>
        <div class="row">
          <button class="small-btn" type="button" id="screenshotAnalyzeBtn" disabled>Analyser billede</button>
          <button class="small-btn" type="button" onclick="closeModal()">Annuller</button>
        </div>
      </div>`;
    bindUploadEvents();
  }

  function bindUploadEvents() {
    const fileInput = document.getElementById("screenshotFile");
    const dropZone = document.getElementById("screenshotDropZone");
    document.getElementById("screenshotChooseBtn")?.addEventListener("click", () => fileInput?.click());
    document.getElementById("screenshotAnalyzeBtn")?.addEventListener("click", analyze);
    fileInput?.addEventListener("change", event => selectFile(event.target.files?.[0]));
    ["dragenter", "dragover"].forEach(type => dropZone?.addEventListener(type, event => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach(type => dropZone?.addEventListener(type, event => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    }));
    dropZone?.addEventListener("drop", event => selectFile(event.dataTransfer?.files?.[0]));
  }

  function selectFile(file) {
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type)) {
      state.status = "Vælg en PNG-, JPG-, WEBP- eller BMP-billedfil.";
      return renderUpload();
    }
    if (file.size > MAX_FILE_BYTES) {
      state.status = "Billedet må højst fylde 12 MB.";
      return renderUpload();
    }
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.file = file;
    state.previewUrl = URL.createObjectURL(file);
    state.status = "Billedet er klar til analyse.";
    const summary = document.getElementById("screenshotFileSummary");
    if (summary) {
      summary.hidden = false;
      summary.innerHTML = `<img src="${state.previewUrl}" alt="Valgt screenshot"><div><strong>${escapeHtml(file.name)}</strong><br><span>${(file.size / 1024 / 1024).toFixed(1)} MB</span></div>`;
    }
    const button = document.getElementById("screenshotAnalyzeBtn");
    if (button) button.disabled = false;
    const status = document.getElementById("screenshotStatus");
    if (status) status.textContent = state.status;
  }

  function updateProgress(message) {
    const progress = document.getElementById("screenshotProgress");
    const fill = document.getElementById("screenshotProgressFill");
    const label = document.getElementById("screenshotProgressText");
    const status = document.getElementById("screenshotStatus");
    if (progress) progress.hidden = false;
    if (fill) fill.style.width = `${state.progress}%`;
    if (label) label.textContent = `${state.progress}%`;
    if (status && message) status.textContent = message;
  }

  async function analyze() {
    if (!state.file || state.processing) return;
    state.processing = true;
    const button = document.getElementById("screenshotAnalyzeBtn");
    if (button) button.disabled = true;
    try {
      state.progress = 5;
      updateProgress("Indlæser lokal OCR...");
      const Tesseract = await loadOcrLibrary();
      const worker = await Tesseract.createWorker("eng+dan", 1, {
        logger: event => {
          if (typeof event.progress !== "number") return;
          state.progress = Math.max(5, Math.min(95, Math.round(event.progress * 100)));
          updateProgress(event.status === "recognizing text" ? "Aflæser træningsdata..." : "Forbereder billedanalyse...");
        }
      });
      const output = await worker.recognize(state.file);
      await worker.terminate();
      state.rawText = output.data?.text || "";
      state.ocrConfidence = Number(output.data?.confidence) || 0;
      state.result = parseOcrText(state.rawText, state.ocrConfidence);
      state.progress = 100;
      updateProgress("Analysen er færdig. Kontrollér resultatet før import.");
      renderReview();
    } catch (error) {
      console.error("Screenshot-import fejlede.", error);
      state.status = error?.message || "Billedet kunne ikke analyseres.";
      const status = document.getElementById("screenshotStatus");
      if (status) status.textContent = state.status;
      if (button) button.disabled = false;
    } finally {
      state.processing = false;
    }
  }

  function renderReview() {
    const content = document.getElementById("modalContent");
    if (!content || !state.result) return;
    content.innerHTML = `
      <div class="screenshot-review">
        <div class="screenshot-review-summary">
          <div><strong>OCR-sikkerhed</strong><span class="confidence-badge ${state.result.confidence < 75 ? "uncertain" : ""}">${state.result.confidence}%</span></div>
          <p>Felter med gul markering kræver ekstra kontrol.</p>
        </div>
        ${state.result.warnings.map(warning => `<div class="screenshot-warning">⚠ ${escapeHtml(warning)}</div>`).join("")}
        <label class="screenshot-field">Programnavn<input id="importProgramTitle" class="field" value="${escapeHtml(state.result.programName || state.result.title)}"></label>
        <div id="importDays">${state.result.days.map(renderDay).join("")}</div>
        <details class="screenshot-ocr-details"><summary>Vis aflæst OCR-tekst</summary><textarea id="importRawText" class="field" rows="8">${escapeHtml(state.rawText)}</textarea><button class="small-btn" type="button" id="reparseImportBtn">Analysér redigeret tekst igen</button></details>
        <div class="row screenshot-review-actions">
          <button class="small-btn save-btn" type="button" id="approveScreenshotImportBtn">Godkend og opret træningspas</button>
          <button class="small-btn" type="button" id="restartScreenshotImportBtn">Vælg et andet billede</button>
          <button class="small-btn" type="button" onclick="closeModal()">Annuller</button>
        </div>
      </div>`;
    document.getElementById("approveScreenshotImportBtn")?.addEventListener("click", approve);
    document.getElementById("restartScreenshotImportBtn")?.addEventListener("click", open);
    document.getElementById("reparseImportBtn")?.addEventListener("click", () => {
      state.rawText = document.getElementById("importRawText")?.value || "";
      state.result = parseOcrText(state.rawText, state.ocrConfidence);
      renderReview();
    });
  }

  function renderDay(day, dayIndex) {
    return `<section class="screenshot-day" data-import-day="${dayIndex}">
      <label class="screenshot-field">Dag<input class="field import-day-title" value="${escapeHtml(day.title)}"></label>
      <div class="screenshot-exercise-list">${day.exercises.length ? day.exercises.map((exercise, exerciseIndex) => renderExercise(exercise, dayIndex, exerciseIndex)).join("") : `<p class="helper-text">Ingen øvelser fundet.</p>`}</div>
      <button class="small-btn import-add-exercise" type="button" onclick="Work4itScreenshotImport.addExerciseRow(this)">Tilføj øvelse</button>
    </section>`;
  }

  function renderExercise(exercise, dayIndex, exerciseIndex) {
    const uncertain = exercise.uncertain ? " uncertain" : "";
    const catalog = getCatalog();
    const suggestions = exercise.matchSuggestions?.length ? exercise.matchSuggestions : catalog.slice(0, 8).map(item => ({ name: item.name, muscle: item.muscle, confidence: 0 }));
    const selected = exercise.matchedName || "";
    const suggestionOptions = [
      `<option value="">Vælg match...</option>`,
      ...suggestions.map(item => `<option value="${escapeHtml(item.name)}" ${item.name === selected ? "selected" : ""}>${escapeHtml(item.name)}${item.confidence ? ` (${item.confidence}%)` : ""}</option>`),
      ...(!selected && exercise.name ? [`<option value="${escapeHtml(exercise.name)}" selected>Brug OCR-navn: ${escapeHtml(exercise.name)}</option>`] : [])
    ].join("");
    const matchText = exercise.matchStatus === "matched"
      ? `Match: ${exercise.matchedName} (${exercise.matchConfidence}%)`
      : exercise.matchStatus === "suggested"
        ? `Forslag: ${exercise.matchedName || "vælg match"} (${exercise.matchConfidence || 0}%)`
        : "Usikkert match - vælg øvelse";
    const warnings = (exercise.warnings || []).map(warning => `<span>${escapeHtml(warning)}</span>`).join("");
    return `<div class="screenshot-exercise${uncertain}" data-import-exercise="${exerciseIndex}">
      <label class="screenshot-field wide">OCR-navn<input class="field import-exercise-name" value="${escapeHtml(exercise.originalName || exercise.name)}"></label>
      <label class="screenshot-field wide">Work4it-match<select class="field import-exercise-match">${suggestionOptions}</select></label>
      <label class="screenshot-field">Sæt<input class="field import-exercise-sets" type="number" min="1" max="20" value="${exercise.setCount}"></label>
      <label class="screenshot-field">Reps<input class="field import-exercise-reps" value="${escapeHtml(exercise.reps)}"></label>
      <label class="screenshot-field">Kg<input class="field import-exercise-weight" type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" value="${escapeHtml(exercise.weight)}" oninput="window.sanitizeKgInput?.(this)"></label>
      <label class="screenshot-field">Pause<input class="field import-exercise-pause" value="${escapeHtml(exercise.pause)}"></label>
      <label class="screenshot-field wide">Noter<input class="field import-exercise-notes" value="${escapeHtml(exercise.notes)}"></label>
      <div class="screenshot-match-status wide">${escapeHtml(matchText)}${warnings ? `<div class="screenshot-field-warnings">${warnings}</div>` : ""}</div>
      <button class="small-btn red import-remove-exercise" type="button" aria-label="Fjern øvelse" onclick="this.closest('.screenshot-exercise').remove()">Slet</button>
    </div>`;
  }

  function collectReview() {
    const title = document.getElementById("importProgramTitle")?.value.trim() || "Importeret træningspas";
    const days = [...document.querySelectorAll("[data-import-day]")].map((dayElement, dayIndex) => ({
      id: `day_${dayIndex + 1}`,
      title: dayElement.querySelector(".import-day-title")?.value.trim() || `Dag ${dayIndex + 1}`,
      exercises: [...dayElement.querySelectorAll("[data-import-exercise]")].map(exerciseElement => {
        const setCount = Math.max(1, Math.min(20, Number(exerciseElement.querySelector(".import-exercise-sets")?.value) || 1));
        const reps = exerciseElement.querySelector(".import-exercise-reps")?.value.trim() || "";
        const weight = exerciseElement.querySelector(".import-exercise-weight")?.value.trim() || "";
        const pause = exerciseElement.querySelector(".import-exercise-pause")?.value.trim() || "";
        const ocrName = exerciseElement.querySelector(".import-exercise-name")?.value.trim() || "";
        const selectedMatch = exerciseElement.querySelector(".import-exercise-match")?.value.trim() || "";
        const selectedExercise = getCatalog().find(exercise => exercise.name === selectedMatch);
        const finalName = selectedMatch || ocrName;
        return {
          name: finalName,
          originalName: ocrName,
          matchedName: selectedMatch,
          matchStatus: selectedMatch ? "approved" : "needs_review",
          muscle: selectedExercise?.muscle || "",
          notes: exerciseElement.querySelector(".import-exercise-notes")?.value.trim() || "",
          sets: Array.from({ length: setCount }, () => ({
            prev: "-", completed: false, weight, reps, targetReps: reps, pause, pauseManual: true
          }))
        };
      }).filter(exercise => exercise.name)
    })).filter(day => day.exercises.length);
    const warnings = [];
    days.forEach(day => day.exercises.forEach(exercise => {
      if (!exercise.matchedName) warnings.push(`${exercise.originalName || exercise.name}: mangler Work4it-match.`);
      if (!exercise.sets?.[0]?.reps) warnings.push(`${exercise.name}: reps mangler.`);
    }));
    return { programName: title, title, days, warnings };
  }

  function addExerciseRow(button) {
    const list = button?.closest(".screenshot-day")?.querySelector(".screenshot-exercise-list");
    if (!list) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderExercise({
      originalName: "",
      name: "",
      matchedName: "",
      muscle: "",
      matchConfidence: 0,
      matchStatus: "needs_review",
      matchSuggestions: getCatalog().slice(0, 8).map(item => ({ name: item.name, muscle: item.muscle, confidence: 0 })),
      setCount: defaultNewExerciseSetCount(),
      reps: "",
      weight: "",
      pause: "",
      notes: "",
      uncertain: true,
      warnings: ["Manuelt tilføjet - vælg øvelse og udfyld manglende felter."]
    }, 0, list.querySelectorAll("[data-import-exercise]").length);
    list.appendChild(wrapper.firstElementChild);
  }

  function approve() {
    const program = collectReview();
    if (!program.days.length) {
      window.alert("Tilføj eller kontrollér mindst én øvelse før import.");
      return;
    }
    if (program.warnings.length) {
      const proceed = window.confirm(`Der er ${program.warnings.length} felt${program.warnings.length === 1 ? "" : "er"} der kræver kontrol:\n\n${program.warnings.slice(0, 6).join("\n")}${program.warnings.length > 6 ? "\n..." : ""}\n\nVil du importere alligevel?`);
      if (!proceed) return;
    }
    window.dispatchEvent(new CustomEvent("screenshot-import:approved", {
      detail: {
        program,
        importMetadata: {
          sourceType: "screenshot",
          sourceName: state.file?.name || "",
          ocrEngine: "Tesseract.js 5.1.1 (eng+dan)",
          ocrConfidence: state.ocrConfidence,
          approvedAt: new Date().toISOString()
        }
      }
    }));
  }

  function open() {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state = createState();
    const title = document.getElementById("modalTitle");
    if (title) title.textContent = "Importér fra screenshot";
    renderUpload();
    window.openModal?.();
  }

  window.Work4itScreenshotImport = {
    open,
    parseText: parseOcrText,
    matchExerciseName,
    addExerciseRow,
    getState: () => ({ ...state, file: state.file ? { name: state.file.name, size: state.file.size, type: state.file.type } : null })
  };
})();
