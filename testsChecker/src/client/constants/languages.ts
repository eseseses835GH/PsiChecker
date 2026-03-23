export const PRESET_LANGUAGES = ["Python", "TypeScript", "HTML", "C"] as const;

export function isPresetLanguage(lang: string): boolean {
  return (PRESET_LANGUAGES as readonly string[]).includes(lang);
}

export function isLanguageFilled(lang: string): boolean {
  return isPresetLanguage(lang) || lang.trim().length > 0;
}
