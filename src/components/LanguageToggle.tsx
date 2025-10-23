import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === "fr" ? "en" : "fr");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleLanguage}
      className="h-9 w-9"
      title={language === "fr" ? "Switch to English" : "Passer en français"}
    >
      <Languages className="h-4 w-4" />
      <span className="ml-1 text-xs font-medium">{language.toUpperCase()}</span>
    </Button>
  );
};
