import type { ChatMode, Tier } from "@/types/chat";
import { cn } from "@/lib/utils";
import { MessageSquare, Brain, GraduationCap } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ModeSelectorProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  tier: Tier;
}

const modes: { value: ChatMode; label: string; icon: typeof MessageSquare; premiumOnly?: boolean }[] = [
  { value: "query", label: "Ask", icon: MessageSquare },
  { value: "quiz", label: "Quiz me", icon: Brain },
  { value: "teacher", label: "Teacher", icon: GraduationCap, premiumOnly: true },
];

export function ModeSelector({ mode, onModeChange, tier }: ModeSelectorProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 rounded-full bg-muted p-1">
        {modes.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.value;
          const isDisabled = m.premiumOnly && tier !== "premium" && tier !== "enterprise";

          const button = (
            <button
              key={m.value}
              onClick={() => !isDisabled && onModeChange(m.value)}
              disabled={isDisabled}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isDisabled
                  ? "text-muted-foreground/50 cursor-not-allowed opacity-60"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 cursor-pointer"
              )}
            >
              <Icon size={14} />
              {m.label}
            </button>
          );

          if (isDisabled) {
            return (
              <Tooltip key={m.value}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent>
                  <p>Teacher mode requires Premium (15,000 UGX/month)</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </div>
    </TooltipProvider>
  );
}