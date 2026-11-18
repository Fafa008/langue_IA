import type { StateStorage } from "zustand/middleware";

const isBrowser = () => typeof window !== "undefined";

/**
 * Stockage pour zustand/persist qui respecte « Se souvenir de moi » :
 * l'état est écrit dans localStorage si `state.remember` est vrai,
 * sinon dans sessionStorage (effacé à la fermeture du navigateur).
 */
export const rememberAwareStorage: StateStorage = {
  getItem: (name) => {
    if (!isBrowser()) return null;
    return localStorage.getItem(name) ?? sessionStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (!isBrowser()) return;
    const remember = Boolean(JSON.parse(value)?.state?.remember);
    const [target, other] = remember ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    target.setItem(name, value);
    other.removeItem(name);
  },
  removeItem: (name) => {
    if (!isBrowser()) return;
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};
