(function (global) {
  "use strict";

  function asArray(value) { return Array.isArray(value) ? value : []; }
  function validDate(value) {
    const date = new Date(value || 0);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  function firstName(profile, user) {
    const candidate = String(profile?.name || user?.displayName || "").trim();
    if (!candidate || candidate.includes("@")) return "";
    return candidate.split(/\s+/)[0] || "";
  }
  function greeting(profile, user, now = new Date()) {
    const name = firstName(profile, user);
    if (!name) return "Velkommen tilbage";
    const hour = now.getHours();
    const prefix = hour < 11 ? "Godmorgen" : hour < 18 ? "God eftermiddag" : "Godaften";
    return `${prefix}, ${name}`;
  }
  function validExercise(exercise) {
    const name = String(exercise?.name || "").trim();
    return Boolean(name && !/^(vælg|vaelg|choose)\b/i.test(name));
  }
  function sessionIsActive(session) {
    return Boolean(
      session &&
      ["in_progress", "paused"].includes(session.sessionStatus) &&
      asArray(session.exercises).some(validExercise)
    );
  }
  function dayForProgram(program) {
    const days = asArray(program?.days);
    const index = Math.min(Math.max(0, Number(program?.activeDayIndex) || 0), Math.max(0, days.length - 1));
    return days[index] || null;
  }
  function exerciseCount(program) { return asArray(dayForProgram(program)?.exercises).filter(validExercise).length; }
  function programHasExercise(program) { return exerciseCount(program) > 0; }
  function todayKey(now) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function scheduledForToday(program, now) {
    const explicit = program?.scheduledDate || program?.plannedDate || dayForProgram(program)?.scheduledDate || dayForProgram(program)?.plannedDate;
    const date = validDate(explicit);
    return date ? todayKey(date) === todayKey(now) : false;
  }
  function latestCompletedWorkout(history) {
    return asArray(history).filter(workout => {
      const status = workout?.workoutStatus || workout?.sessionStatus || "completed";
      return status === "completed" && !workout?.deletedAt && workout?.simulated !== true;
    }).sort((a, b) => (validDate(b.completedAt || b.date)?.getTime() || 0) - (validDate(a.completedAt || a.date)?.getTime() || 0))[0] || null;
  }
  function workoutSets(workout) {
    return asArray(workout?.exercises).flatMap(exercise => asArray(exercise?.sets));
  }
  function activeCard(session) {
    if (!sessionIsActive(session)) return null;
    const sets = workoutSets(session);
    return {
      title: session.programTitle || session.title || "Aktiv træning",
      status: session.sessionStatus === "paused" ? "Pauset" : "Aktiv",
      statusCode: session.sessionStatus,
      elapsedSeconds: Math.max(0, Number(session.timerSeconds) || 0),
      completedSets: sets.filter(set => set?.completed === true).length,
      totalSets: sets.length
    };
  }
  function chooseProgram(programs, input, latest, now) {
    const list = asArray(programs).filter(programHasExercise);
    const scheduled = list.find(program => scheduledForToday(program, now));
    if (scheduled) return { program: scheduled, heading: "Dagens træning", source: "scheduled" };
    const lastId = input.lastActiveProgramId || input.currentProgramId || "";
    const lastSelected = list.find(program => program.id === lastId);
    if (lastSelected) return { program: lastSelected, heading: "Fortsæt med", source: "last-selected" };
    const lastUsedId = latest?.programId || latest?.sourceProgramId || "";
    const lastUsed = list.find(program => program.id === lastUsedId);
    if (lastUsed) return { program: lastUsed, heading: "Fortsæt med", source: "last-used" };
    return list[0] ? { program: list[0], heading: "Næste træning", source: "first-saved" } : null;
  }
  function latestCard(workout) {
    if (!workout) return null;
    const summary = workout.completionAnalysis?.summary || {};
    const completedSets = Number(summary.completedSets) || workoutSets(workout).filter(set => set?.completed === true).length;
    const volume = Number(summary.totalVolumeKg) || Number(workout.totalVolume) || 0;
    return {
      id: workout.id || workout.sessionId || "",
      title: workout.title || workout.dayTitle || workout.programTitle || "Træning",
      date: workout.completedAt || workout.date || null,
      durationSeconds: Math.max(0, Number(workout.durationSeconds) || 0),
      completedSets: Math.max(0, completedSets),
      totalVolumeKg: Math.max(0, volume),
      personalRecords: asArray(summary.personalRecords).length
    };
  }
  function documentedRecommendation(active, latest) {
    if (active?.statusCode === "paused") return { type: "paused-workout", message: "Du har en pauset træning, som endnu ikke er afsluttet." };
    const item = asArray(latest?.completionAnalysis?.recommendations).find(recommendation => String(recommendation?.message || "").trim());
    return item ? { type: item.type || "progression", message: String(item.message).trim() } : null;
  }

  function buildDashboardViewModel(input = {}) {
    const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
    const programs = asArray(input.programs).filter(program => program && typeof program === "object");
    const latest = latestCompletedWorkout(input.history);
    const active = activeCard(input.activeWorkout);
    const selection = active ? null : chooseProgram(programs, input, latest, now);
    const featuredWorkout = selection ? {
      id: selection.program.id || "",
      title: selection.program.title || "Træningspas",
      heading: selection.heading,
      source: selection.source,
      exerciseCount: exerciseCount(selection.program),
      dayCount: Math.max(1, asArray(selection.program.days).length),
      estimatedMinutes: Number(selection.program.estimatedMinutes) > 0 ? Number(selection.program.estimatedMinutes) : null
    } : null;
    return {
      greeting: greeting(input.profile, input.user, now),
      activeWorkout: active,
      featuredWorkout,
      primaryAction: active
        ? { type: "resume-workout", label: "Fortsæt træning", workoutId: input.activeWorkout?.sessionId || "" }
        : featuredWorkout
          ? { type: "start-workout", label: "Start træning", workoutId: featuredWorkout.id }
          : null,
      latestWorkout: latestCard(latest),
      recommendation: documentedRecommendation(active, latest),
      emptyState: !active && programs.length === 0
    };
  }

  global.Work4itDashboard = Object.freeze({ buildDashboardViewModel });
}(typeof window !== "undefined" ? window : globalThis));
