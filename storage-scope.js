(function workitStorageScopeModule() {
  "use strict";

  const PREFIX = "workit";
  const LEGACY_RESOLUTION_KEY = `${PREFIX}:legacyMigrationResolution`;
  const KEY_ALIASES = {
    training_profile_v1: "profile",
    daily_start_v1: "daily",
    ai_training_membership_v1: "membership",
    saved_workout_programs: "programs",
    training_analytics_history: "sessions",
    body_measurement_history: "measurements",
    ai_copilot_history: "aiHistory",
    screenshot_imports: "imports",
    custom_exercises: "customExercises",
    deleted_workout_programs: "trash",
    active_workout_autosave: "activeWorkout",
    last_active_program_id: "lastProgram"
  };
  const managedKeys = new Set(Object.keys(KEY_ALIASES));
  const original = {
    getItem: localStorage.getItem.bind(localStorage),
    setItem: localStorage.setItem.bind(localStorage),
    removeItem: localStorage.removeItem.bind(localStorage),
    clear: localStorage.clear.bind(localStorage)
  };
  const pendingWrites = new Map();
  let activeUid = "";

  function scopedKey(key, uid = activeUid) {
    if (!uid || !managedKeys.has(key)) return key;
    return `${PREFIX}:${uid}:${KEY_ALIASES[key]}`;
  }

  function parse(value, fallback = null) {
    try {
      return value == null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function comparable(value) {
    if (!value || typeof value !== "object") return JSON.stringify(value);
    const clone = Array.isArray(value) ? [...value] : { ...value };
    if (!Array.isArray(clone)) {
      delete clone.updatedAt;
      delete clone.firestoreUpdatedAt;
      delete clone._cacheUpdatedAt;
    }
    return JSON.stringify(clone);
  }

  function itemId(value, index) {
    return String(value?.id ?? value?.sessionId ?? value?.date ?? value?.timestamp ?? index);
  }

  function stampValue(key, rawValue) {
    if (key === "last_active_program_id") return String(rawValue);
    const next = parse(rawValue, rawValue);
    const previous = parse(original.getItem(scopedKey(key)), null);
    const now = new Date().toISOString();
    if (Array.isArray(next)) {
      const previousItems = new Map((Array.isArray(previous) ? previous : []).map((item, index) => [
        itemId(item, index),
        item
      ]));
      return JSON.stringify(next.map((item, index) => {
        if (!item || typeof item !== "object") return item;
        const oldItem = previousItems.get(itemId(item, index));
        const unchanged = oldItem && comparable(oldItem) === comparable(item);
        return {
          ...item,
          updatedAt: unchanged
            ? oldItem.updatedAt || oldItem.savedAt || oldItem.date || now
            : now
        };
      }));
    }
    if (next && typeof next === "object") {
      return JSON.stringify({ ...next, updatedAt: now });
    }
    return String(rawValue);
  }

  function notify(key, operation) {
    window.dispatchEvent(new CustomEvent("workit-storage:changed", {
      detail: { key, operation, uid: activeUid }
    }));
  }

  localStorage.getItem = function getScopedItem(key) {
    if (!managedKeys.has(String(key))) return original.getItem(key);
    if (!activeUid) return null;
    return original.getItem(scopedKey(String(key)));
  };

  localStorage.setItem = function setScopedItem(key, value) {
    const logicalKey = String(key);
    if (!managedKeys.has(logicalKey)) {
      original.setItem(logicalKey, value);
      return;
    }
    if (!activeUid) {
      pendingWrites.set(logicalKey, String(value));
      return;
    }
    original.setItem(scopedKey(logicalKey), stampValue(logicalKey, value));
    notify(logicalKey, "set");
  };

  localStorage.removeItem = function removeScopedItem(key) {
    const logicalKey = String(key);
    if (!managedKeys.has(logicalKey)) {
      original.removeItem(logicalKey);
      return;
    }
    pendingWrites.delete(logicalKey);
    if (!activeUid) return;
    original.removeItem(scopedKey(logicalKey));
    notify(logicalKey, "remove");
  };

  // Ryd kun den aktive brugers cache. Globale, ikke-personlige indstillinger bevares.
  localStorage.clear = function clearActiveUserCache() {
    if (!activeUid) return;
    for (const key of managedKeys) original.removeItem(scopedKey(key));
    notify("*", "clear");
  };

  function setActiveUid(uid) {
    activeUid = String(uid || "");
    if (!activeUid) {
      pendingWrites.clear();
      return;
    }
    for (const [key, value] of pendingWrites) {
      const target = scopedKey(key);
      if (original.getItem(target) == null) original.setItem(target, stampValue(key, value));
    }
    pendingWrites.clear();
  }

  function hasCurrentUserData() {
    return Boolean(activeUid && [...managedKeys].some(key => original.getItem(scopedKey(key)) != null));
  }

  function hasLegacyData() {
    return [...managedKeys].some(key => {
      const value = original.getItem(key);
      if (value == null) return false;
      const parsed = parse(value, value);
      return Array.isArray(parsed)
        ? parsed.length > 0
        : typeof parsed === "object"
          ? parsed && Object.keys(parsed).length > 0
          : Boolean(parsed);
    });
  }

  function legacyResolution() {
    return parse(original.getItem(LEGACY_RESOLUTION_KEY), null);
  }

  function resolveLegacyMigration(status, uid) {
    original.setItem(LEGACY_RESOLUTION_KEY, JSON.stringify({
      status,
      uid: status === "accepted" ? String(uid || "") : "",
      resolvedAt: new Date().toISOString()
    }));
  }

  function importLegacyToCurrent() {
    if (!activeUid) return false;
    for (const key of managedKeys) {
      const legacy = original.getItem(key);
      if (legacy == null) continue;
      const target = scopedKey(key);
      const currentRaw = original.getItem(target);
      const legacyValue = parse(legacy, legacy);
      const currentValue = parse(currentRaw, currentRaw);
      let imported = legacyValue;
      if (Array.isArray(legacyValue) && Array.isArray(currentValue)) {
        const merged = new Map();
        legacyValue.forEach((item, index) => merged.set(itemId(item, index), item));
        currentValue.forEach((item, index) => merged.set(itemId(item, index), item));
        imported = [...merged.values()];
      } else if (
        legacyValue && currentValue &&
        typeof legacyValue === "object" &&
        typeof currentValue === "object"
      ) {
        imported = { ...legacyValue, ...currentValue };
      } else if (currentRaw != null) {
        imported = currentValue;
      }
      original.setItem(
        target,
        stampValue(key, key === "last_active_program_id" ? imported : JSON.stringify(imported))
      );
      original.setItem(`${PREFIX}:legacyBackup:${activeUid}:${KEY_ALIASES[key]}`, legacy);
      original.removeItem(key);
    }
    return true;
  }

  function exportCurrentUserData() {
    const data = {};
    if (!activeUid) return data;
    for (const key of managedKeys) {
      const raw = original.getItem(scopedKey(key));
      if (raw == null) continue;
      data[key] = parse(raw, raw);
    }
    return data;
  }

  function clearCurrentUserCache() {
    if (!activeUid) return;
    for (const key of managedKeys) original.removeItem(scopedKey(key));
    notify("*", "clear");
  }

  function writeCurrentRaw(key, value) {
    if (!activeUid || !managedKeys.has(key)) return false;
    const target = scopedKey(key);
    if (value == null) original.removeItem(target);
    else original.setItem(target, key === "last_active_program_id" ? String(value) : JSON.stringify(value));
    return true;
  }

  window.WorkitStorageScope = {
    keys: { ...KEY_ALIASES },
    managedKeys: [...managedKeys],
    setActiveUid,
    getActiveUid: () => activeUid,
    scopedKey,
    hasCurrentUserData,
    hasLegacyData,
    legacyResolution,
    resolveLegacyMigration,
    importLegacyToCurrent,
    exportCurrentUserData,
    clearCurrentUserCache,
    writeCurrentRaw
  };
})();
