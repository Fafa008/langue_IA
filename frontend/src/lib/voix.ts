/* Voix du navigateur : synthèse (lecture à voix haute) et reconnaissance vocale, par langue. */

/** Code de langue → locale du navigateur ; pour une autre langue, le code seul (« es ») suffit. */
export const LOCALES: Record<string, string> = {
  en: "en-US",
  fr: "fr-FR",
  zh: "zh-CN",
  it: "it-IT",
  de: "de-DE",
};

export const localeDe = (langue: string) => LOCALES[langue] ?? langue;

export const syntheseDisponible = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Lit un texte à voix haute (interrompt la lecture précédente) ; renvoie false si la synthèse est absente. */
export function lireAVoixHaute(texte: string, langue: string, surFin?: () => void): boolean {
  if (!syntheseDisponible()) return false;
  window.speechSynthesis.cancel();
  const enonce = new SpeechSynthesisUtterance(texte);
  enonce.lang = localeDe(langue);
  enonce.rate = 0.9;
  enonce.onend = () => surFin?.();
  enonce.onerror = () => surFin?.();
  window.speechSynthesis.speak(enonce);
  return true;
}
