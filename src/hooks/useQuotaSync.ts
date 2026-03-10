/**
 * useQuotaSync: Synchronizes daily question quota with Supabase rate_limits table
 * 
 * Features:
 * - Fetches actual used count on mount
 * - Handles daily reset detection (at midnight)
 * - Polls to catch midnight boundary
 * - Auto-updates when a new question is asked (via invalidate)
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tier } from "@/types/chat";
import { TIER_DAILY_LIMITS } from "@/types/chat";

interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number;
}

export function useQuotaSync(userTier: Tier | null, userId: string | null) {
  const [quota, setQuota] = useState<QuotaState>({
    used: 0,
    limit: userTier ? TIER_DAILY_LIMITS[userTier] : 5,
    remaining: userTier ? TIER_DAILY_LIMITS[userTier] : 5,
    isLoading: true,
    error: null,
    lastFetchedAt: 0,
  });

  // ── Fetch quota from database ──────────────────────────────────────────────
  const fetchQuota = useCallback(async () => {
    if (!userId || !userTier) {
      setQuota((prev) => ({
        ...prev,
        isLoading: false,
        error: "User not authenticated",
      }));
      return;
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      const limit = TIER_DAILY_LIMITS[userTier];

      // Fetch rate_limits entry for this user
      const { data, error: dbError } = await supabase
        .from("rate_limits")
        .select("daily_count, last_day")
        .eq("user_id", userId)
        .single();

      if (dbError) {
        // First time user — no rate_limits entry yet
        if (dbError.code === "PGRST116") {
          console.log("[Quota] First request — rate_limits entry will be created by backend");
          setQuota({
            used: 0,
            limit,
            remaining: limit,
            isLoading: false,
            error: null,
            lastFetchedAt: Date.now(),
          });
          return;
        }
        throw new Error(`Failed to fetch quota: ${dbError.message}`);
      }

      // Check if we need to reset (different day)
      const lastDay = data?.last_day ?? today;
      const dailyCount = lastDay === today ? (data?.daily_count ?? 0) : 0;

      // If day changed, effectively reset the counter
      const used = dailyCount;
      const remaining = Math.max(0, limit - used);

      console.log(
        `[Quota] User: ${userId.slice(0, 8)}... | Tier: ${userTier} | ` +
        `Used: ${used}/${limit} | Last reset: ${lastDay} | Today: ${today}`
      );

      setQuota({
        used,
        limit,
        remaining,
        isLoading: false,
        error: null,
        lastFetchedAt: Date.now(),
      });
    } catch (err: any) {
      console.error("[Quota] Error fetching:", err);
      setQuota((prev) => ({
        ...prev,
        isLoading: false,
        error: err.message || "Failed to fetch quota",
      }));
    }
  }, [userId, userTier]);

  // ── Initial fetch on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetchQuota();
  }, [userId, userTier, fetchQuota]);

  // ── Poll for midnight boundary (check every 5 minutes) ────────────────────
  useEffect(() => {
    const pollInterval = setInterval(() => {
      const now = new Date();
      const lastFetchedDate = new Date(quota.lastFetchedAt);

      // Only refetch if we crossed into a new day
      if (
        now.toISOString().slice(0, 10) !==
        lastFetchedDate.toISOString().slice(0, 10)
      ) {
        console.log("[Quota] Day boundary detected — refreshing quota");
        fetchQuota();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(pollInterval);
  }, [quota.lastFetchedAt, fetchQuota]);

  // ── Invalidate/refresh quota after a question is asked ────────────────────
  const invalidate = useCallback(() => {
    // Small delay to ensure backend has updated rate_limits
    setTimeout(() => {
      fetchQuota();
    }, 500);
  }, [fetchQuota]);

  return {
    ...quota,
    refresh: fetchQuota,
    invalidate,
  };
}
