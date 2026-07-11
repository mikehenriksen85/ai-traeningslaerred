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
  const MONTHLY_TYPES = new Set(["premium_3", "premium_6", "premium_12"]);
  const PLAN_ALIASES = {
    quarterly: "premium_3",
    semiannual: "premium_6",
    yearly: "premium_12",
    lifetime: "premium_12",
    trial: "free"
  };
  let snapshot = {
    membershipType: "free",
    membershipStatus: "free",
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
    const normalized = PLAN_ALIASES[value] || value;
    return ["free", "premium_3", "premium_6", "premium_12"].includes(normalized) ? normalized : "free";
  }

  function normalizeMembershipStatus(value, membershipType = "free") {
    if (value === "active") return "active";
    if (membershipType === "free") return "free";
    return "pending_payment";
  }

  function effectiveMembershipType(data = {}) {
    if (data.role === "admin") return "premium_12";
    const membershipType = normalizeMembershipType(data.membershipType);
    const membershipStatus = normalizeMembershipStatus(data.membershipStatus, membershipType);
    if (MONTHLY_TYPES.has(membershipType) && membershipStatus === "active") return membershipType;
    return "free";
  }

  function limitFor(type) {
    if (MONTHLY_TYPES.has(type)) return PREMIUM_LIMIT;
    return FREE_LIMIT;
  }

  function normalizeUsage(data = {}, now = new Date()) {
    const isAdmin = data.role === "admin";
    if (isAdmin) {
      return {
        membershipType: "premium_12",
        membershipStatus: "active",
        role: "admin",
        isAdmin: true,
        aiRequestLimit: -1,
        aiRequestsUsed: 0,
        aiResetDate: null,
        lastRequestTimestamp: data.lastRequestTimestamp || null,
        remaining: -1,
        allowed: true,
        source: data.source || "admin"
      };
    }
    const rawMembershipType = normalizeMembershipType(data.membershipType);
    const membershipStatus = normalizeMembershipStatus(data.membershipStatus, rawMembershipType);
    const membershipType = effectiveMembershipType({ membershipType: rawMembershipType, membershipStatus });
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
      membershipStatus,
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
        role: data.role || membership.role || "",
        membershipType: normalizeMembershipType(data.membershipType || membership.membershipType),
        membershipStatus: data.membershipStatus || membership.membershipStatus,
        source: "firestore"
      });
      const payload = {
        aiRequestLimit: normalized.aiRequestLimit,
        aiRequestsUsed: normalized.aiRequestsUsed,
        aiResetDate: normalized.aiResetDate,
        lastRequestTimestamp: normalized.lastRequestTimestamp,
        updatedAt: nowIso(),
        firestoreUpdatedAt: serverTimestamp()
      };
      if (!current.exists()) {
        payload.membershipType = normalized.membershipType;
        payload.membershipStatus = normalized.membershipStatus;
      }
      await setDoc(reference, payload, { merge: true });
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
          role: cloudData.role || membership.role || "",
          membershipType: normalizeMembershipType(cloudData.membershipType || membership.membershipType),
          membershipStatus: cloudData.membershipStatus || membership.membershipStatus,
          source: "firestore"
        });
        if (normalized.isAdmin) return normalized;
        if (normalized.remaining <= 0) {
          const payload = {
            aiRequestLimit: normalized.aiRequestLimit,
            aiRequestsUsed: normalized.aiRequestsUsed,
            aiResetDate: normalized.aiResetDate,
            lastRequestTimestamp: normalized.lastRequestTimestamp,
            updatedAt: nowIso(),
            firestoreUpdatedAt: serverTimestamp()
          };
          if (!current.exists()) {
            payload.membershipType = normalized.membershipType;
            payload.membershipStatus = normalized.membershipStatus;
          }
          transaction.set(reference, payload, { merge: true });
          return { ...normalized, allowed: false };
        }
        const next = normalizeUsage({
          ...normalized,
          aiRequestsUsed: normalized.aiRequestsUsed + 1,
          lastRequestTimestamp: nowIso(),
          source: "firestore"
        });
        const payload = {
          aiRequestLimit: next.aiRequestLimit,
          aiRequestsUsed: next.aiRequestsUsed,
          aiResetDate: next.aiResetDate,
          lastRequestTimestamp: next.lastRequestTimestamp,
          updatedAt: nowIso(),
          firestoreUpdatedAt: serverTimestamp()
        };
        if (!current.exists()) {
          payload.membershipType = next.membershipType;
          payload.membershipStatus = next.membershipStatus;
        }
        transaction.set(reference, payload, { merge: true });
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
      premium: PREMIUM_LIMIT
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
