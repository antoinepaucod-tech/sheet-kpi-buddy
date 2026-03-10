import { useLanguage } from "../contexts/LanguageContext";

export function useTranslations() {
  const { t, lang, setLang } = useLanguage();
  return { t, lang, setLang };
}
