import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type OnboardingStatus = "all" | "complete" | "partial" | "none";

interface OnboardingFilterProps {
  value: OnboardingStatus;
  onChange: (value: OnboardingStatus) => void;
}

export const OnboardingFilter = ({ value, onChange }: OnboardingFilterProps) => {
  const filters: { status: OnboardingStatus; label: string; icon: React.ReactNode; color: string }[] = [
    { 
      status: "all", 
      label: "Tous", 
      icon: null,
      color: "bg-muted text-foreground"
    },
    { 
      status: "complete", 
      label: "Complet", 
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30"
    },
    { 
      status: "partial", 
      label: "Partiel", 
      icon: <Circle className="h-3.5 w-3.5" />,
      color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30"
    },
    { 
      status: "none", 
      label: "Non commencé", 
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
    },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground mr-1">Onboarding:</span>
      {filters.map((filter) => (
        <Button
          key={filter.status}
          variant="outline"
          size="sm"
          onClick={() => onChange(filter.status)}
          className={cn(
            "h-7 text-xs gap-1.5 transition-all",
            value === filter.status && filter.color,
            value === filter.status && "border-2"
          )}
        >
          {filter.icon}
          {filter.label}
        </Button>
      ))}
    </div>
  );
};

// Helper function to calculate onboarding status
export const getOnboardingStatus = (member: {
  onboarding_bsport: boolean;
  onboarding_hubfit: boolean;
  onboarding_nutrition: boolean;
  questionnaire_coaching: boolean;
  session_introduction: boolean;
}): OnboardingStatus => {
  const steps = [
    member.onboarding_bsport,
    member.onboarding_hubfit,
    member.onboarding_nutrition,
    member.questionnaire_coaching,
    member.session_introduction,
  ];
  
  const completedCount = steps.filter(Boolean).length;
  
  if (completedCount === 5) return "complete";
  if (completedCount > 0) return "partial";
  return "none";
};
