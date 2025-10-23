import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/translations';

export const useTranslations = () => {
  const { language } = useLanguage();
  
  const t = (key: string): string => {
    const translation = translations[language as keyof typeof translations];
    return translation[key as keyof typeof translation] || key;
  };
  
  return { t };
};
