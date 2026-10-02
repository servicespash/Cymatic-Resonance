import type { EntitlementPlan } from "@/lib/domain/contracts";
import { DEFAULT_TRIAL_DAYS, MAX_TRIAL_DAYS, isPaidPlan } from "./catalog";

export interface TrialState {
  hasUsedTrial: boolean;
  plan: EntitlementPlan;
  active: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number;
}

export function normalizeTrialDays(days: number): number {
  if (!Number.isInteger(days) || days < 1 || days > MAX_TRIAL_DAYS) {
    throw new Error(`Trial duration must be an integer from 1 to ${MAX_TRIAL_DAYS} days`);
  }
  return days;
}

export function trialStateFromServer(
  basePlan: EntitlementPlan,
  trialPlan: EntitlementPlan | null,
  hasUsedTrial: boolean,
  startedAt: string | null,
  expiresAt: string | null,
  serverNow: string,
): TrialState {
  const active =
    hasUsedTrial &&
    isPaidPlan(trialPlan ?? "FREE") &&
    !!expiresAt &&
    new Date(expiresAt).getTime() > new Date(serverNow).getTime();

  const effectivePlan = active ? (trialPlan as EntitlementPlan) : basePlan;

  return {
    hasUsedTrial,
    plan: effectivePlan,
    active,
    startedAt,
    expiresAt,
    daysRemaining:
      active && expiresAt
        ? Math.max(
            0,
            Math.ceil(
              (new Date(expiresAt).getTime() - new Date(serverNow).getTime()) /
                86_400_000,
            ),
          )
        : 0,
  };
}

export const DEFAULT_TRIAL_DURATION_DAYS = DEFAULT_TRIAL_DAYS;
