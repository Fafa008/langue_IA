import type { Activite, EntitesParType, FiltresContenus, LangueResume, Lecon, Module, Parcours, SaisiesParType, TypeEntite } from "./types";

/**
 * Accès aux contenus pédagogiques. Aujourd'hui implémenté en mémoire (mock-service.ts) ; une implémentation
 * branchée sur l'API pourra le remplacer sans changer les composants (choix fait dans hooks/useContenus.ts).
 * Les méthodes d'écriture revalident les règles (validation.ts) et rejettent une ErreurContenus.
 */
export interface ContenusService {
  /** Toutes les langues, avec leurs niveaux et leurs compteurs (modules, leçons, activités, parcours). */
  listLangues(): Promise<LangueResume[]>;
  listModules(codeLangue: string, filtres?: FiltresContenus): Promise<Module[]>;
  listLecons(codeLangue: string, filtres?: FiltresContenus): Promise<Lecon[]>;
  listActivites(codeLangue: string, filtres?: FiltresContenus): Promise<Activite[]>;
  listParcours(codeLangue: string, filtres?: FiltresContenus): Promise<Parcours[]>;
  /** null : aucune entité de ce type avec cet identifiant. */
  get<T extends TypeEntite>(type: T, id: string): Promise<EntitesParType[T] | null>;
  create<T extends TypeEntite>(type: T, codeLangue: string, saisie: SaisiesParType[T]): Promise<EntitesParType[T]>;
  update<T extends TypeEntite>(type: T, id: string, saisie: SaisiesParType[T]): Promise<EntitesParType[T]>;
  /** Passe l'entité au statut Archivé (RG-GP-08). */
  archive(type: TypeEntite, id: string): Promise<void>;
  /** Suppression définitive, refusée si l'entité est utilisée (RG-GP-09). */
  remove(type: TypeEntite, id: string): Promise<void>;
}

/** Refus du service : message général et, pour un formulaire, erreurs par champ. */
export class ErreurContenus extends Error {
  constructor(
    message: string,
    readonly champs: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ErreurContenus";
  }
}
