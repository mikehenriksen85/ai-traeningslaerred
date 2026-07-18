(function (global) {
  "use strict";

  function asArray(value) { return Array.isArray(value) ? value : []; }
  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  function dateFrom(value) {
    if (value?.toDate instanceof Function) return value.toDate();
    if (value?.seconds != null) return new Date(Number(value.seconds) * 1000);
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      return new Date(year, month - 1, day, 12);
    }
    const date = new Date(value || 0);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  function localDateKey(value, timeZone) {
    const date = dateFrom(value);
    if (!date) return "";
    if (timeZone) {
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
        return `${parts.year}-${parts.month}-${parts.day}`;
      } catch {}
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function dateFromKey(key) {
    const [year, month, day] = String(key).split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }
  function shiftDateKey(key, amount) {
    const date = dateFromKey(key);
    date.setDate(date.getDate() + amount);
    return localDateKey(date);
  }
  function exerciseSets(workout) {
    return asArray(workout?.exercises).flatMap(exercise => asArray(exercise?.sets));
  }
  function completedSets(workout) {
    const summaryValue = number(workout?.completionAnalysis?.summary?.completedSets);
    if (summaryValue) return summaryValue;
    return exerciseSets(workout).filter(set => set?.completed === true).length;
  }
  function durationSeconds(workout) {
    const direct = number(workout?.durationSeconds);
    if (direct) return direct;
    const minutes = number(workout?.durationMinutes) || number(workout?.cardioSummary?.durationMinutes);
    return minutes * 60;
  }
  function totalVolumeKg(workout) {
    return number(workout?.completionAnalysis?.summary?.totalVolumeKg) || number(workout?.totalVolumeKg) || number(workout?.totalVolume);
  }
  function completedStatus(workout) {
    return String(workout?.workoutStatus || workout?.sessionStatus || workout?.status || "").toLowerCase() === "completed";
  }
  function excludedWorkout(workout) {
    const status = String(workout?.status || "").toLowerCase();
    const type = String(workout?.type || workout?.entryType || "").toLowerCase();
    const source = String(workout?.source || workout?.sourceType || "").toLowerCase();
    return Boolean(
      workout?.deletedAt || workout?.trashedAt || workout?.isDeleted === true || workout?.deleted === true ||
      workout?.inTrash === true || workout?.trashed === true || ["deleted", "trash", "trashed"].includes(status) ||
      workout?.simulated === true || workout?.isSimulation === true || workout?.simulation === true ||
      workout?.isTest === true || workout?.test === true || ["simulation", "simulated", "test"].includes(type) ||
      ["simulation", "simulated", "test"].includes(source)
    );
  }
  function timestampFor(workout) {
    return workout?.completedAt || workout?.date || workout?.startedAt || null;
  }
  function stableWorkoutKey(workout) {
    const stable = workout?.sessionId || workout?.workoutId || workout?.id;
    if (stable !== "" && stable != null) return `id:${String(stable)}`;
    const fingerprint = [
      localDateKey(timestampFor(workout)),
      String(workout?.completedAt || workout?.date || workout?.startedAt || ""),
      String(workout?.programId || ""),
      String(workout?.dayId || ""),
      String(workout?.title || workout?.dayTitle || workout?.programTitle || ""),
      durationSeconds(workout),
      completedSets(workout),
      totalVolumeKg(workout)
    ].join("|");
    return `legacy:${fingerprint}`;
  }
  function validatedWorkouts(history, options) {
    const seen = new Set();
    const userId = String(options.userId || "");
    return asArray(history).filter(workout => {
      if (!workout || typeof workout !== "object" || !completedStatus(workout) || excludedWorkout(workout)) return false;
      const owner = String(workout.userId || workout.uid || workout.ownerId || "");
      if (userId && owner && owner !== userId) return false;
      if (!localDateKey(timestampFor(workout), options.timeZone)) return false;
      const key = stableWorkoutKey(workout);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function isoWeekStartKey(dateKey) {
    const date = dateFromKey(dateKey);
    const weekday = date.getDay() || 7;
    date.setDate(date.getDate() - weekday + 1);
    return localDateKey(date);
  }
  function consecutiveCount(sortedKeys, stepDays, endKey) {
    const keys = new Set(sortedKeys);
    let count = 0;
    let cursor = endKey;
    while (keys.has(cursor)) {
      count += 1;
      cursor = shiftDateKey(cursor, -stepDays);
    }
    return count;
  }
  function longestConsecutive(sortedKeys, stepDays) {
    if (!sortedKeys.length) return 0;
    const keys = new Set(sortedKeys);
    let longest = 0;
    for (const key of sortedKeys) {
      if (keys.has(shiftDateKey(key, -stepDays))) continue;
      let length = 1;
      let cursor = shiftDateKey(key, stepDays);
      while (keys.has(cursor)) {
        length += 1;
        cursor = shiftDateKey(cursor, stepDays);
      }
      longest = Math.max(longest, length);
    }
    return longest;
  }
  function percentileRank(value, values) {
    if (values.length <= 1) return 0.5;
    const lower = values.filter(candidate => candidate < value).length;
    const equal = values.filter(candidate => candidate === value).length;
    return (lower + Math.max(0, equal - 1) / 2) / (values.length - 1);
  }
  function applyActivityLevels(activeDays) {
    if (!activeDays.length) return;
    const setValues = activeDays.map(day => day.completedSets);
    const durationValues = activeDays.map(day => day.durationSeconds);
    const volumeValues = activeDays.map(day => day.totalVolumeKg).filter(Boolean);
    const scores = activeDays.map(day => {
      const setsRank = percentileRank(day.completedSets, setValues);
      const durationRank = percentileRank(day.durationSeconds, durationValues);
      const volumeRank = day.totalVolumeKg && volumeValues.length > 1 ? percentileRank(day.totalVolumeKg, volumeValues) : 0.5;
      return (setsRank * 0.5) + (durationRank * 0.35) + (volumeRank * 0.15) + Math.min(0.1, (day.workoutCount - 1) * 0.05);
    });
    activeDays.forEach((day, index) => {
      const rank = percentileRank(scores[index], scores);
      day.activityLevel = scores.length === 1 ? 2 : Math.min(4, 1 + Math.floor(rank * 4));
    });
  }

  function buildWorkoutHeatmap(workoutHistory, options = {}) {
    const periodDays = Math.max(1, Math.min(3650, Number(options.days) || 365));
    const endDate = localDateKey(options.endDate || options.now || new Date(), options.timeZone);
    const startDate = shiftDateKey(endDate, -(periodDays - 1));
    const workouts = validatedWorkouts(workoutHistory, options).filter(workout => {
      const key = localDateKey(timestampFor(workout), options.timeZone);
      return key >= startDate && key <= endDate;
    });
    const grouped = new Map();
    workouts.forEach(workout => {
      const date = localDateKey(timestampFor(workout), options.timeZone);
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date).push(workout);
    });
    const days = [];
    for (let index = 0; index < periodDays; index += 1) {
      const date = shiftDateKey(startDate, index);
      const entries = grouped.get(date) || [];
      days.push({
        date,
        workoutCount: entries.length,
        completedSets: entries.reduce((sum, workout) => sum + completedSets(workout), 0),
        durationSeconds: entries.reduce((sum, workout) => sum + durationSeconds(workout), 0),
        totalVolumeKg: entries.reduce((sum, workout) => sum + totalVolumeKg(workout), 0),
        activityLevel: 0,
        workoutIds: entries.map(stableWorkoutKey),
        workouts: entries.map(workout => ({
          key: stableWorkoutKey(workout),
          id: workout.id ?? null,
          sessionId: workout.sessionId || "",
          title: workout.title || workout.dayTitle || workout.programTitle || "Træning",
          completedAt: timestampFor(workout),
          durationSeconds: durationSeconds(workout),
          completedSets: completedSets(workout),
          totalVolumeKg: totalVolumeKg(workout)
        }))
      });
    }
    const activeDays = days.filter(day => day.workoutCount > 0);
    applyActivityLevels(activeDays);
    const activeDayKeys = activeDays.map(day => day.date).sort();
    const activeWeekKeys = [...new Set(activeDayKeys.map(isoWeekStartKey))].sort();
    const todayKey = endDate;
    const currentWeek = isoWeekStartKey(todayKey);
    const previousWeek = shiftDateKey(currentWeek, -7);
    const weeklyStreakEnd = activeWeekKeys.includes(currentWeek) ? currentWeek : activeWeekKeys.includes(previousWeek) ? previousWeek : currentWeek;
    const last30Start = shiftDateKey(endDate, -29);
    return {
      startDate,
      endDate,
      days,
      totalWorkouts: workouts.length,
      activeDays: activeDays.length,
      workoutsLast30Days: activeDays.filter(day => day.date >= last30Start).reduce((sum, day) => sum + day.workoutCount, 0),
      currentStreak: consecutiveCount(activeDayKeys, 1, endDate),
      longestStreak: longestConsecutive(activeDayKeys, 1),
      currentWeekStreak: consecutiveCount(activeWeekKeys, 7, weeklyStreakEnd),
      longestWeekStreak: longestConsecutive(activeWeekKeys, 7),
      activeWeeks: activeWeekKeys.length,
      deduplicatedWorkoutCount: workouts.length,
      definition: "En aktiv uge er en ISO-uge (mandag-søndag) med mindst én afsluttet træning. Den aktuelle ugerække må slutte i denne eller sidste uge."
    };
  }

  global.Work4itWorkoutHeatmap = Object.freeze({
    buildWorkoutHeatmap,
    localDateKey,
    stableWorkoutKey
  });
}(typeof window !== "undefined" ? window : globalThis));
