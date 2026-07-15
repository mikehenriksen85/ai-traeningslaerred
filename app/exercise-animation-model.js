(function () {
  "use strict";

  const MODES = Object.freeze(["standard", "muscle", "slowMotion", "alternateAngle"]);
  const STATUSES = Object.freeze(["missing", "draft", "pending_review", "approved", "rejected", "failed"]);
  const DEFAULT_CAMERA = "front_three_quarter";
  const DEFAULT_DURATION = 4;

  function clean(value) {
    return String(value || "").trim();
  }

  function slug(value) {
    return clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "").slice(0, 42) || "exercise";
  }

  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) {
      result ^= character.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36).padStart(7, "0").slice(0, 7);
  }

  function exerciseId(name, muscle = "") {
    const identity = `${slug(name)}|${slug(muscle)}`;
    return `ex_${slug(name)}_${hash(identity)}`;
  }

  function movementFor(name) {
    const value = clean(name).toLowerCase();
    if (/squat|leg press|lunge|step-up|wall sit/.test(value)) return "squat";
    if (/deadlift|good morning|hip hinge|romanian|kettlebell swing/.test(value)) return "hinge";
    if (/bench press|chest press|push-up|push up|floor press/.test(value)) return "horizontal_press";
    if (/overhead press|shoulder press|military press|push press/.test(value)) return "vertical_press";
    if (/pull-up|pull up|chin-up|chin up|pulldown/.test(value)) return "vertical_pull";
    if (/row|face pull/.test(value)) return "horizontal_pull";
    if (/curl/.test(value)) return "curl";
    if (/pushdown|triceps|skull crusher|extension/.test(value)) return "extension";
    if (/plank|hollow|dead bug|bird dog/.test(value)) return "stability";
    if (/run|l\u00f8b|walk|gang|stair|bike|cykel|crosstrainer/.test(value)) return "cardio";
    return "unsupported";
  }

  function equipmentFor(name) {
    const value = clean(name).toLowerCase();
    const equipment = [];
    if (/barbell|ez-bar|stang/.test(value)) equipment.push("barbell");
    if (/dumbbell|h\u00e5ndv\u00e6gt/.test(value)) equipment.push("dumbbell");
    if (/cable|kabel|pulldown|pushdown/.test(value)) equipment.push("cable");
    if (/machine|maskine|leg press|pec deck/.test(value)) equipment.push("machine");
    if (/bench|b\u00e6nk/.test(value)) equipment.push("bench");
    return equipment.length ? equipment : ["bodyweight"];
  }

  function originalSpecification({ name, muscle = "", equipment = [], movement = "" }) {
    const resolvedMovement = movement || movementFor(name);
    return {
      schemaVersion: 1,
      exerciseId: exerciseId(name, muscle),
      exerciseName: clean(name),
      muscleGroup: clean(muscle),
      equipment: equipment.length ? [...new Set(equipment.map(clean).filter(Boolean))] : equipmentFor(name),
      movement: resolvedMovement,
      duration: DEFAULT_DURATION,
      loop: true,
      cameraAngle: DEFAULT_CAMERA,
      availableModes: [...MODES],
      visualStyle: "work4it_original_neutral_3d_v1",
      sourceAssets: [],
      rights: "original_procedural",
      keyframes: [
        { time: 0, phase: "start" },
        { time: 0.5, phase: "end" },
        { time: 1, phase: "start" }
      ]
    };
  }

  function validateSpecification(specification) {
    const errors = [];
    const spec = specification && typeof specification === "object" ? specification : {};
    if (spec.schemaVersion !== 1) errors.push("schemaVersion skal v\u00e6re 1");
    if (!/^ex_[a-z0-9-]+_[a-z0-9]{7}$/.test(clean(spec.exerciseId))) errors.push("exerciseId er ugyldigt");
    if (!clean(spec.exerciseName)) errors.push("exerciseName mangler");
    if (!clean(spec.movement)) errors.push("movement mangler");
    if (!(Number(spec.duration) >= 3 && Number(spec.duration) <= 5)) errors.push("duration skal v\u00e6re 3-5 sekunder");
    if (spec.loop !== true) errors.push("loop skal v\u00e6re true");
    if (spec.cameraAngle !== DEFAULT_CAMERA) errors.push("cameraAngle skal bruge fase 1-standardvinklen");
    if (!MODES.every(mode => Array.isArray(spec.availableModes) && spec.availableModes.includes(mode))) errors.push("availableModes er ufuldst\u00e6ndig");
    if (spec.rights !== "original_procedural" || (spec.sourceAssets || []).length) errors.push("Kun originale, asset-frie specifikationer accepteres");
    if (!Array.isArray(spec.keyframes) || spec.keyframes.length < 3) errors.push("Mindst tre validerede keyframes kr\u00e6ves");
    return { valid: errors.length === 0, errors };
  }

  function normalizeMetadata(value, fallback = {}) {
    const input = value && typeof value === "object" ? value : {};
    return {
      exerciseId: clean(input.exerciseId || fallback.exerciseId),
      animationUrl: clean(input.animationUrl),
      thumbnailUrl: clean(input.thumbnailUrl),
      duration: Number(input.duration || DEFAULT_DURATION),
      version: Math.max(1, Number.parseInt(input.version || 1, 10)),
      generationStatus: STATUSES.includes(input.generationStatus) ? input.generationStatus : "missing",
      cameraAngle: clean(input.cameraAngle || DEFAULT_CAMERA),
      availableModes: [...new Set(Array.isArray(input.availableModes) ? input.availableModes : MODES)],
      specification: input.specification || null,
      updatedAt: input.updatedAt || null
    };
  }

  function validateMetadata(value) {
    const metadata = normalizeMetadata(value);
    const errors = [];
    if (!metadata.exerciseId.startsWith("ex_")) errors.push("exerciseId mangler");
    if (!(metadata.duration >= 3 && metadata.duration <= 5)) errors.push("duration skal v\u00e6re 3-5 sekunder");
    if (!STATUSES.includes(metadata.generationStatus)) errors.push("generationStatus er ugyldig");
    if (!MODES.every(mode => metadata.availableModes.includes(mode))) errors.push("availableModes er ufuldst\u00e6ndig");
    if (metadata.generationStatus === "approved" && !metadata.animationUrl) errors.push("Godkendte animationer kr\u00e6ver animationUrl");
    if (metadata.specification) errors.push(...validateSpecification(metadata.specification).errors);
    return { valid: errors.length === 0, errors, metadata };
  }

  function generatorPrompt(context) {
    const specification = originalSpecification(context);
    return {
      system: "Skab kun en original Work4it-bev\u00e6gelsesspecifikation. Kopi\u00e9r aldrig andre apps, firmaer, videoer, modeller eller animationer. Return\u00e9r kun JSON, som matcher schemaVersion 1.",
      input: { exerciseName: specification.exerciseName, muscleGroup: specification.muscleGroup, equipment: specification.equipment, movement: specification.movement },
      constraints: { durationSeconds: [3, 5], loop: true, cameraAngle: DEFAULT_CAMERA, neutralFigure: true, availableModes: MODES },
      expected: specification
    };
  }

  async function generateSpecification(context, generator = window.Work4itAnimationSpecGenerator) {
    const expectedId = exerciseId(context?.name, context?.muscle);
    let candidate;
    if (typeof generator === "function") {
      candidate = await generator(generatorPrompt(context));
      if (typeof candidate === "string") candidate = JSON.parse(candidate);
    } else {
      candidate = originalSpecification(context || {});
    }
    if (clean(candidate?.exerciseId) !== expectedId) throw new Error("Generatoren returnerede et forkert exerciseId");
    const validation = validateSpecification(candidate);
    if (!validation.valid) throw new Error(validation.errors.join("; "));
    return candidate;
  }

  function escapeHtml(value) {
    return clean(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function poseFor(movement, progress) {
    const phase = (1 - Math.cos(progress * Math.PI * 2)) / 2;
    const pose = { hipY: 0, torso: 0, knee: 0.08, elbow: 0.12, arm: 0.1, bodyX: 0, bodyY: 0 };
    if (movement === "squat") Object.assign(pose, { hipY: phase * 0.48, torso: phase * 0.12, knee: phase * 0.42 });
    if (movement === "hinge") Object.assign(pose, { hipY: phase * 0.12, torso: phase * 0.58, knee: phase * 0.16 });
    if (movement === "horizontal_press") Object.assign(pose, { bodyY: 0.25, torso: -1.22, arm: phase * 0.62, elbow: (1 - phase) * 0.65 });
    if (movement === "vertical_press") Object.assign(pose, { arm: phase * -0.95, elbow: (1 - phase) * 0.55 });
    if (movement === "vertical_pull") Object.assign(pose, { bodyY: phase * -0.32, arm: -0.9, elbow: phase * 0.62 });
    if (movement === "horizontal_pull") Object.assign(pose, { torso: 0.38, arm: phase * 0.5, elbow: phase * 0.72 });
    if (movement === "curl") Object.assign(pose, { elbow: phase * 1.15 });
    if (movement === "extension") Object.assign(pose, { arm: -0.55, elbow: (1 - phase) * 1.05 });
    if (movement === "stability") Object.assign(pose, { bodyY: 0.28, torso: -1.42, arm: 0.45 });
    if (movement === "cardio") Object.assign(pose, { bodyY: Math.abs(Math.sin(progress * Math.PI * 4)) * -0.05, arm: Math.sin(progress * Math.PI * 4) * 0.48, knee: Math.sin(progress * Math.PI * 4) * 0.35 });
    return pose;
  }

  function startProceduralRenderer(canvas, specification) {
    const context = canvas.getContext("2d");
    if (!context) return () => {};
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let frame = 0;
    let stopped = false;
    const start = performance.now();
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(320, Math.floor(canvas.clientWidth * ratio));
      canvas.height = Math.max(240, Math.floor(canvas.clientHeight * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();

    function draw(now) {
      if (stopped || !canvas.isConnected) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const progress = reduceMotion ? 0 : ((now - start) / (specification.duration * 1000)) % 1;
      const pose = poseFor(specification.movement, progress);
      context.clearRect(0, 0, width, height);
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#122239"); gradient.addColorStop(1, "#07111f");
      context.fillStyle = gradient; context.fillRect(0, 0, width, height);
      context.strokeStyle = "rgba(94,234,212,.18)"; context.lineWidth = 1;
      for (let x = 0; x < width; x += 38) { context.beginPath(); context.moveTo(x, height * .78); context.lineTo(width / 2 + (x - width / 2) * .25, height); context.stroke(); }
      context.fillStyle = "rgba(0,0,0,.32)"; context.beginPath(); context.ellipse(width / 2, height * .86, 72, 16, 0, 0, Math.PI * 2); context.fill();

      const scale = Math.min(width, height) * .23;
      const cx = width / 2 + pose.bodyX * scale;
      const cy = height * .62 + pose.bodyY * scale;
      const project = (x, y, z = 0) => [cx + (x + z * .34) * scale, cy + y * scale - z * scale * .12];
      const hip = project(0, pose.hipY, 0), shoulder = project(Math.sin(pose.torso) * .62, pose.hipY - Math.cos(pose.torso) * .62, 0);
      const head = project(Math.sin(pose.torso) * .82, pose.hipY - Math.cos(pose.torso) * .82, 0);
      const limb = (a, b, widthValue, color = "#b8c7d9") => { context.strokeStyle = color; context.lineWidth = widthValue; context.lineCap = "round"; context.beginPath(); context.moveTo(...a); context.lineTo(...b); context.stroke(); };
      const joint = (point, radius = 7) => { context.fillStyle = "#d7e3ee"; context.beginPath(); context.arc(point[0], point[1], radius, 0, Math.PI * 2); context.fill(); };

      [-1, 1].forEach((side, index) => {
        const depth = side * .16;
        const knee = project(side * .17 + Math.sin(pose.knee * side) * .1, pose.hipY + .54 - Math.abs(pose.knee) * .12, depth);
        const foot = project(side * .18 + Math.sin(pose.knee * side) * .24, pose.hipY + 1.03 - Math.abs(pose.knee) * .17, depth + .05);
        limb(hip, knee, 16, index ? "#a8bacd" : "#71869f"); limb(knee, foot, 14, index ? "#b8c7d9" : "#7f94ab"); joint(knee, 6);
      });
      limb(hip, shoulder, 25, "#8ea4bb"); joint(hip, 10); joint(shoulder, 11);
      [-1, 1].forEach((side, index) => {
        const angle = pose.arm * side;
        const elbow = project(Math.sin(pose.torso) * .62 + side * .13 + Math.sin(angle) * .38, pose.hipY - Math.cos(pose.torso) * .62 + Math.cos(angle) * .38, side * .2);
        const handAngle = angle + pose.elbow * side;
        const hand = project(Math.sin(pose.torso) * .62 + side * .13 + Math.sin(angle) * .38 + Math.sin(handAngle) * .34, pose.hipY - Math.cos(pose.torso) * .62 + Math.cos(angle) * .38 + Math.cos(handAngle) * .34, side * .22);
        limb(shoulder, elbow, 13, index ? "#c6d3df" : "#768ba3"); limb(elbow, hand, 11, index ? "#d5e0e9" : "#879bb0"); joint(elbow, 5); joint(hand, 5);
      });
      context.fillStyle = "#dbe7ef"; context.beginPath(); context.arc(head[0], head[1], 19, 0, Math.PI * 2); context.fill();
      context.fillStyle = "rgba(94,234,212,.9)"; context.font = "600 13px system-ui"; context.fillText("ORIGINAL WORK4IT MOTION", 16, 24);
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }

  function recordingMimeType() {
    if (!window.MediaRecorder) return "";
    return [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4"
    ].find(type => MediaRecorder.isTypeSupported?.(type)) || "";
  }

  function canvasThumbnail(canvas) {
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        resolve(blob ? new File([blob], "thumbnail.webp", { type: "image/webp" }) : null);
      }, "image/webp", 0.82);
    });
  }

  async function renderSpecificationToVideo(specification, onProgress = () => {}) {
    const mimeType = recordingMimeType();
    if (!mimeType || !HTMLCanvasElement.prototype.captureStream) {
      throw new Error("Denne browser kan ikke rendere video automatisk. Brug Chrome, Edge eller den installerede Work4it PWA.");
    }
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;left:-10000px;top:0;width:640px;height:400px;pointer-events:none";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const stopRenderer = startProceduralRenderer(canvas, specification);
    const stream = canvas.captureStream(24);
    const chunks = [];
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1600000 });
      recorder.addEventListener("dataavailable", event => { if (event.data?.size) chunks.push(event.data); });
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener("stop", resolve, { once: true });
        recorder.addEventListener("error", event => reject(event.error || new Error("Video-rendering fejlede")), { once: true });
      });
      recorder.start(500);
      const durationMs = Math.round(Number(specification.duration || DEFAULT_DURATION) * 1000);
      const startedAt = Date.now();
      await new Promise(resolve => {
        const update = () => {
          const elapsed = Date.now() - startedAt;
          onProgress(Math.min(100, Math.round(elapsed / durationMs * 100)));
          if (elapsed >= durationMs) resolve();
          else setTimeout(update, 250);
        };
        update();
      });
      const thumbnailFile = await canvasThumbnail(canvas);
      recorder.stop();
      await stopped;
      const baseType = recorder.mimeType.split(";")[0] || mimeType.split(";")[0];
      const extension = baseType === "video/mp4" ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: baseType });
      if (!blob.size) throw new Error("Browseren returnerede en tom animationsfil");
      return {
        mediaFile: new File([blob], `animation.${extension}`, { type: baseType }),
        thumbnailFile
      };
    } finally {
      if (recorder?.state === "recording") recorder.stop();
      stream.getTracks().forEach(track => track.stop());
      stopRenderer();
      canvas.remove();
    }
  }

  function renderMissing(container, name, supported) {
    container.innerHTML = `<div class="exercise-animation-placeholder" role="status"><div class="exercise-animation-placeholder-icon" aria-hidden="true">◇</div><strong>Animation er ikke klar endnu</strong><p>${supported ? "En original animation af denne \u00f8velse afventer godkendelse." : "Bev\u00e6gelsen mangler endnu en valideret animationsspecifikation."}</p></div>`;
  }

  function renderMedia(container, metadata, name) {
    const url = metadata.animationUrl;
    if (/\.gif(?:$|\?)/i.test(url)) {
      container.innerHTML = `<img class="exercise-animation-media" src="${escapeHtml(url)}" alt="Animation af ${escapeHtml(name)}" loading="eager">`;
      return;
    }
    container.innerHTML = `<video class="exercise-animation-media" autoplay loop muted playsinline preload="metadata" ${metadata.thumbnailUrl ? `poster="${escapeHtml(metadata.thumbnailUrl)}"` : ""} aria-label="Animation af ${escapeHtml(name)}"><source src="${escapeHtml(url)}"></video>`;
  }

  async function adminGenerate(exercise) {
    const status = document.getElementById("exerciseAnimationAdminStatus");
    if (status) status.textContent = "Validerer animationsspecifikation…";
    try {
      const spec = window.Work4itAISystem?.createExerciseAnimationSpecification
        ? await window.Work4itAISystem.createExerciseAnimationSpecification(exercise)
        : await generateSpecification(exercise);
      const cloud = window.Work4itExerciseAnimationCloud;
      if (!cloud?.saveDraft) throw new Error("Cloud-tjenesten er ikke klar");
      const saved = await cloud.saveDraft(spec);
      if (status) status.textContent = `Kladde v${saved.version} er valideret. Renderer original animation…`;
      let rendered;
      try {
        rendered = await renderSpecificationToVideo(spec, progress => {
          if (status) status.textContent = `Renderer original animation… ${progress}%`;
        });
        if (status) status.textContent = "Uploader den genererede animation til Work4it Storage…";
        await cloud.uploadVersionMedia(exercise.exerciseId, saved.version, rendered.mediaFile, rendered.thumbnailFile);
      } catch (renderError) {
        console.error("[Work4it animation] Automatisk rendering fejlede", renderError);
        await openViewer(exercise);
        const fallbackStatus = document.getElementById("exerciseAnimationAdminStatus");
        if (fallbackStatus) fallbackStatus.textContent = `${renderError.message} Manuel upload kan bruges som reserve.`;
        return;
      }
      await openViewer(exercise);
    } catch (error) {
      console.error("[Work4it animation] Specifikation kunne ikke oprettes", error);
      if (status) status.textContent = `Fejl: ${error.message}`;
    }
  }

  async function adminUpload(exercise, version) {
    const input = document.getElementById("exerciseAnimationMediaFile");
    const thumbnail = document.getElementById("exerciseAnimationThumbnailFile");
    const status = document.getElementById("exerciseAnimationAdminStatus");
    if (!input?.files?.[0]) { if (status) status.textContent = "V\u00e6lg en WebM-, MP4- eller GIF-fil f\u00f8rst."; return; }
    try {
      if (status) status.textContent = "Uploader originalt medie til Cloud Storage…";
      await window.Work4itExerciseAnimationCloud.uploadVersionMedia(exercise.exerciseId, version, input.files[0], thumbnail?.files?.[0] || null);
      if (status) status.textContent = "Upload fuldf\u00f8rt. Versionen afventer manuel godkendelse.";
      await openViewer(exercise);
    } catch (error) {
      console.error("[Work4it animation] Upload fejlede", error);
      if (status) status.textContent = `Upload fejlede: ${error.message}`;
    }
  }

  async function adminApprove(exercise, version) {
    const status = document.getElementById("exerciseAnimationAdminStatus");
    try {
      if (status) status.textContent = "Godkender version…";
      await window.Work4itExerciseAnimationCloud.approveVersion(exercise.exerciseId, version);
      await openViewer(exercise);
    } catch (error) {
      console.error("[Work4it animation] Godkendelse fejlede", error);
      if (status) status.textContent = `Godkendelse fejlede: ${error.message}`;
    }
  }

  async function openViewer(input) {
    const exercise = typeof input === "string" ? { name: input } : { ...(input || {}) };
    exercise.name = clean(exercise.name);
    exercise.muscle = clean(exercise.muscle);
    exercise.exerciseId = exercise.exerciseId || exerciseId(exercise.name, exercise.muscle);
    if (!exercise.name) return;
    const title = document.getElementById("modalTitle"), content = document.getElementById("modalContent");
    if (!title || !content) return;
    title.textContent = `Demo · ${exercise.name}`;
    content.innerHTML = `<section class="exercise-animation-viewer" aria-busy="true"><div class="exercise-animation-loading" role="status">Henter intern animation…</div></section>`;
    window.openModal?.();
    let record = null;
    try { record = await window.Work4itExerciseAnimationCloud?.getAnimation?.(exercise.exerciseId); }
    catch (error) { console.warn("[Work4it animation] Metadata kunne ikke hentes", error); }
    const metadata = record ? normalizeMetadata(record, exercise) : normalizeMetadata({ exerciseId: exercise.exerciseId });
    const isAdmin = window.Work4itAdminConfig?.isCurrentUserAdmin?.() === true;
    const draft = isAdmin
      ? await window.Work4itExerciseAnimationCloud?.getLatestVersion?.(exercise.exerciseId).catch(() => null)
      : null;
    const previewMetadata = isAdmin && draft?.animationUrl
      ? normalizeMetadata(draft, exercise)
      : metadata;
    const viewer = document.querySelector(".exercise-animation-viewer");
    if (!viewer) return;
    viewer.setAttribute("aria-busy", "false");
    viewer.innerHTML = `<div class="exercise-animation-stage"></div><div class="exercise-animation-meta"><span>${escapeHtml(previewMetadata.cameraAngle.replaceAll("_", " "))}</span><span>${previewMetadata.duration} sek. loop</span><span>v${previewMetadata.version}</span>${draft?.animationUrl && metadata.generationStatus !== "approved" ? "<span>Afventer din godkendelse</span>" : ""}</div><p class="exercise-animation-note">Original Work4it-animation. Standardvisning i fase 1.</p>`;
    const stage = viewer.querySelector(".exercise-animation-stage");
    const spec = previewMetadata.specification;
    if ((previewMetadata.generationStatus === "approved" || isAdmin) && previewMetadata.animationUrl) renderMedia(stage, previewMetadata, exercise.name);
    else if (previewMetadata.generationStatus === "approved" && spec && validateSpecification(spec).valid) {
      stage.innerHTML = `<canvas class="exercise-animation-canvas" role="img" aria-label="Original 3D-animation af ${escapeHtml(exercise.name)}"></canvas>`;
      startProceduralRenderer(stage.querySelector("canvas"), spec);
    } else renderMissing(stage, exercise.name, movementFor(exercise.name) !== "unsupported");

    if (isAdmin) {
      const draftVersion = Number(draft?.version || metadata.version || 1);
      viewer.insertAdjacentHTML("beforeend", `<details class="exercise-animation-admin" open><summary>Administrator · animationspipeline</summary><p>Work4it genererer og uploader automatisk en original animation. Den bliver f\u00f8rst aktiv, n\u00e5r du har set og godkendt den.</p><div class="exercise-animation-admin-actions"><button class="btn secondary" type="button" id="exerciseAnimationGenerate">Gener\u00e9r original animation</button>${draft ? `<label>Manuel reservefil (WebM/MP4/GIF)<input id="exerciseAnimationMediaFile" type="file" accept="video/webm,video/mp4,image/gif"></label><label>Thumbnail (valgfri)<input id="exerciseAnimationThumbnailFile" type="file" accept="image/webp,image/png,image/jpeg"></label><button class="btn secondary" type="button" id="exerciseAnimationUpload">Upload reservefil v${draftVersion}</button><button class="btn primary" type="button" id="exerciseAnimationApprove" ${draft.animationUrl ? "" : "disabled"}>Godkend den viste animation</button>` : ""}</div><div id="exerciseAnimationAdminStatus" class="helper-text" role="status"></div></details>`);
      document.getElementById("exerciseAnimationGenerate")?.addEventListener("click", () => adminGenerate(exercise));
      document.getElementById("exerciseAnimationUpload")?.addEventListener("click", () => adminUpload(exercise, draftVersion));
      document.getElementById("exerciseAnimationApprove")?.addEventListener("click", () => adminApprove(exercise, draftVersion));
    }
  }

  window.Work4itExerciseAnimations = Object.freeze({
    MODES, STATUSES, DEFAULT_CAMERA, exerciseId, movementFor, equipmentFor,
    originalSpecification, generatorPrompt, generateSpecification, validateSpecification,
    normalizeMetadata, validateMetadata, openViewer, startProceduralRenderer,
    renderSpecificationToVideo, recordingMimeType
  });
})();
