import type { Tier } from "@/types/chat";
import { TIER_DAILY_LIMITS } from "@/types/chat";

interface DailyLimitBadgeProps {
  tier: Tier;
  used: number;
}

export function DailyLimitBadge({ tier, used }: DailyLimitBadgeProps) {
  const limit = TIER_DAILY_LIMITS[tier];
  const remaining = Math.max(0, limit - used);
  const isLow = remaining <= 1;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={isLow ? "text-destructive font-medium" : ""}
      >
        {remaining}/{limit}
      </span>
      <span>questions left today</span>
    </div>
  );
}
