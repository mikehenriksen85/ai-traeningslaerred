import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js?v=20260628-auth-ready1";

(function aiRequestCounterModule() {
  "use strict";

  const LOCAL_KEY = "work4it_ai_request_usage_v1";
  const FREE_LIMIT = 3;
  const PREMIUM_LIMIT = 15;
  const LIFETIME_LIMIT = 30;
  const MONTHLY_TYPES = new Set(["trial", "quarterly", "yearly", "lifetime"]);
  let snapshot = {
    membershipType: "free",
    aiRequestLimit: FREE_LIMIT,
    aiRequestsUsed: 0,
    aiResetDate: null,
    lastRequestTimestamp: null,
    remaining: FREE_LIMIT,
    allowed: true,
    source: "initial"
  };

  function nowIso(now = new Date()) {
    return now.toISOString();
  }

  function nextMonthStart(now = new Date()) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0).toISOString();
  }

  function isResetDue(resetDate, now = new Date()) {
    if (!resetDate) return true;
    const parsed = new Date(resetDate);
    return Number.isFinite(parsed.getTime()) && parsed <= now;
  }

  function normalizeMembershipType(value) {
    return ["trial", "free", "quarterly", "yearly", "lifetime"].includes(value) ? value : "free";
  }

  function limitFor(type) {
    if (type === "lifetime") return LIFETIME_LIMIT;
    if (MONTHLY_TYPES.has(type)) return PREMIUM_LIMIT;
    return FREE_LIMIT;
  }

  function normalizeUsage(data = {}, now = new Date()) {
    const membershipType = normalizeMembershipType(data.membershipType);
    const aiRequestLimit = limitFor(membershipType);
    const monthly = MONTHLY_TYPES.has(membershipType);
    let aiRequestsUsed = Math.max(0, Number(data.aiRequestsUsed) || 0);
    let aiResetDate = monthly ? data.aiResetDate || nextMonthStart(now) : null;

    if (monthly && isResetDue(aiResetDate, now)) {
      aiRequestsUsed = 0;
      aiResetDate = nextMonthStart(now);
    }

    const remaining = Math.max(0, aiRequestLimit - aiRequestsUsed);
    return {
      membershipType,
      aiRequestLimit,
      aiRequestsUsed,
      aiResetDate,
      lastRequestTimestamp: data.lastRequestTimestamp || null,
      remaining,
      allowed: remaining > 0,
      source: data.source || "normalized"
    };
  }

  function writeLocal(data) {
    snapshot = normalizeUsage({ ...data, source: data.source || "local" });
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot));
    } catch {}
    dispatchChanged(snapshot);
    return snapshot;
  }

  function readLocal() {
    try {
      return normalizeUsage(JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"), new Date());
    } catch {
      return normalizeUsage({}, new Date());
    }
  }

  function membershipReference(uid) {
    return doc(db, "users", uid, "membership", "main");
  }

  async function refresh() {
    const user = auth.currentUser || window.FirebaseAuthService?.getCurrentUser?.() || null;
    if (!user?.uid) {
      snapshot = readLocal();
      dispatchChanged(snapshot);
      return snapshot;
    }

    try {
      const reference = membershipReference(user.uid);
      const current = await getDoc(reference);
      const data = current.exists() ? current.data() : {};
      const membership = window.Membership?.getMembership?.() || {};
      const normalized = normalizeUsage({
        ...data,
        membershipType: normalizeMembershipType(data.membershipType || membership.membershipType),
        source: "firestore"
      });
      await setDoc(reference, {
        membershipType: normalized.membershipType,
        aiRequestLimit: normalized.aiRequestLimit,
        aiRequestsUsed: normalized.aiRequestsUsed,
        aiResetDate: normalized.aiResetDate,
        lastRequestTimestamp: normalized.lastRequestTimestamp,
        updatedAt: nowIso(),
        firestoreUpdatedAt: serverTimestamp()
      }, { merge: true });
      snapshot = normalized;
      writeLocal({ ...normalized, source: "cache" });
      snapshot = { ...normalized, source: "firestore" };
      dispatchChanged(snapshot);
      return snapshot;
    } catch (error) {
      console.error("[Work4it AI Requests] refresh failed", error);
      snapshot = { ...readLocal(), source: "local_fallback", errorCode: error?.code || "" };
      dispatchChanged(snapshot);
      return snapshot;
    }
  }

  async function consumeRequest() {
    const user = auth.currentUser || window.FirebaseAuthService?.getCurrentUser?.() || null;
    if (!user?.uid) {
      const current = readLocal();
      if (current.remaining <= 0) {
        snapshot = current;
        dispatchChanged(snapshot);
        return { ...snapshot, allowed: false };
      }
      return writeLocal({
        ...current,
        aiRequestsUsed: current.aiRequestsUsed + 1,
        lastRequestTimestamp: nowIso(),
        source: "local_fallback"
      });
    }

    try {
      const reference = membershipReference(user.uid);
      const result = await runTransaction(db, async transaction => {
        const current = await transaction.get(reference);
        const cloudData = current.exists() ? current.data() : {};
        const membership = window.Membership?.getMembership?.() || {};
        const normalized = normalizeUsage({
          ...cloudData,
          membershipType: normalizeMembershipType(cloudData.membershipType || membership.membershipType),
          source: "firestore"
        });
        if (normalized.remaining <= 0) {
          transaction.set(reference, {
            membershipType: normalized.membershipType,
            aiRequestLimit: normalized.aiRequestLimit,
            aiRequestsUsed: normalized.aiRequestsUsed,
            aiResetDate: normalized.aiResetDate,
            lastRequestTimestamp: normalized.lastRequestTimestamp,
            updatedAt: nowIso(),
            firestoreUpdatedAt: serverTimestamp()
          }, { merge: true });
          return { ...normalized, allowed: false };
        }
        const next = normalizeUsage({
          ...normalized,
          aiRequestsUsed: normalized.aiRequestsUsed + 1,
          lastRequestTimestamp: nowIso(),
          source: "firestore"
        });
        transaction.set(reference, {
          membershipType: next.membershipType,
          aiRequestLimit: next.aiRequestLimit,
          aiRequestsUsed: next.aiRequestsUsed,
          aiResetDate: next.aiResetDate,
          lastRequestTimestamp: next.lastRequestTimestamp,
          updatedAt: nowIso(),
          firestoreUpdatedAt: serverTimestamp()
        }, { merge: true });
        return next;
      });
      snapshot = result;
      writeLocal({ ...result, source: "cache" });
      snapshot = { ...result, source: "firestore" };
      dispatchChanged(snapshot);
      return snapshot;
    } catch (error) {
      console.error("[Work4it AI Requests] consume failed", error);
      const fallback = readLocal();
      if (fallback.remaining <= 0) {
        snapshot = { ...fallback, source: "local_fallback", errorCode: error?.code || "" };
        dispatchChanged(snapshot);
        return { ...snapshot, allowed: false };
      }
      return writeLocal({
        ...fallback,
        aiRequestsUsed: fallback.aiRequestsUsed + 1,
        lastRequestTimestamp: nowIso(),
        source: "local_fallback",
        errorCode: error?.code || ""
      });
    }
  }

  function getSnapshot() {
    return { ...snapshot };
  }

  function dispatchChanged(detail) {
    window.dispatchEvent(new CustomEvent("ai-requests:changed", { detail: { ...detail } }));
  }

  window.Work4itAIRequestCounter = {
    refresh,
    consumeRequest,
    getSnapshot,
    limits: {
      free: FREE_LIMIT,
      premium: PREMIUM_LIMIT,
      lifetime: LIFETIME_LIMIT
    }
  };

  window.addEventListener("firestore:user-ready", () => refresh());
  window.addEventListener("firestore:data-hydrated", () => refresh());
  window.addEventListener("membership:changed", () => refresh());
  window.addEventListener("membership:cloud-saved", () => refresh());
  window.addEventListener("firestore:user-cache-cleared", () => {
    snapshot = readLocal();
    dispatchChanged(snapshot);
  });
  window.addEventListener("training-app:ready", () => refresh(), { once: true });
}());
