import type { ChatMode, Tier } from "@/types/chat";
import { cn } from "@/lib/utils";
import { MessageSquare, Brain, GraduationCap } from "lucide-react";

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
    <div className="flex items-center gap-1 rounded-full bg-muted p-1">
      {modes.map((m) => {
        if (m.premiumOnly && tier !== "premium") return null;
        const Icon = m.icon;
        const isActive = mode === m.value;
        return (
          <button
            key={m.value}
            onClick={() => onModeChange(m.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60"
            )}
          >
            <Icon size={14} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
