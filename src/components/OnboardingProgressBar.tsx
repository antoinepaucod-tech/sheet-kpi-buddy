import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OnboardingProgressBarProps {
  steps: {
    label: string;
    completed: boolean;
  }[];
  className?: string;
  showLabels?: boolean;
}

export const OnboardingProgressBar = ({
  steps,
  className,
  showLabels = false,
}: OnboardingProgressBarProps) => {
  const completedCount = steps.filter((s) => s.completed).length;
  const totalSteps = steps.length;
  const percentage = Math.round((completedCount / totalSteps) * 100);

  const getProgressColor = () => {
    if (percentage === 100) return "bg-green-500";
    if (percentage >= 60) return "bg-emerald-500";
    if (percentage >= 40) return "bg-yellow-500";
    if (percentage >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            {/* Progress bar */}
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
              <div
                className={cn("h-full transition-all duration-300", getProgressColor())}
                style={{ width: `${percentage}%` }}
              />
            </div>
            
            {/* Fraction text */}
            <span className={cn(
              "text-xs font-medium whitespace-nowrap",
              percentage === 100 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
            )}>
              {completedCount}/{totalSteps}
            </span>
            
            {/* Checkmark if complete */}
            {percentage === 100 && (
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-sm">Onboarding: {percentage}%</p>
            <ul className="text-xs space-y-0.5">
              {steps.map((step, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  {step.completed ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <Circle className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={step.completed ? "text-foreground" : "text-muted-foreground"}>
                    {step.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
