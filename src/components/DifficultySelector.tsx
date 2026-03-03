import type { Difficulty } from "@/types/chat";
import { cn } from "@/lib/utils";

interface DifficultySelectorProps {
  difficulty: Difficulty | undefined;
  onDifficultyChange: (d: Difficulty | undefined) => void;
}

const options: { value: Difficulty | undefined; label: string }[] = [
  { value: undefined, label: "Any" },
  { value: "low", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "Hard" },
];

export function DifficultySelector({ difficulty, onDifficultyChange }: DifficultySelectorProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">Difficulty:</span>
      {options.map((o) => {
        const isActive = difficulty === o.value;
        return (
          <button
            key={o.label}
            onClick={() => onDifficultyChange(o.value)}
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
