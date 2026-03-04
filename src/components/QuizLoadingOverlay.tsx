import { Loader2 } from "lucide-react";

interface QuizLoadingOverlayProps {
  message?: string;
}

export function QuizLoadingOverlay({ message = "Loading your questions…" }: QuizLoadingOverlayProps) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">{message}</p>
      </div>
    </div>
  );
}
