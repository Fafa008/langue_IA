import type { CadreReference, DomaineFaiblesse, SourceReferentiel } from "@/types/test-diagnostic";

/*
 * Référentiel simulé pour la démonstration : descripteurs reformulés à partir des échelles globales du CECRL
 * (et de leur équivalent HSK). Le vrai backend les retrouvera par RAG dans le référentiel indexé.
 */

const URL_CECRL = "https://www.coe.int/fr/web/common-european-framework-reference-languages";

const DESCRIPTEURS_GLOBAUX = [
  "Comprend et utilise des expressions familières et quotidiennes, peut se présenter et répondre à des questions simples.",
  "Comprend des phrases isolées liées à des domaines familiers et communique lors de tâches simples et habituelles.",
  "Comprend l'essentiel de sujets familiers, se débrouille en voyage et produit un discours simple et cohérent.",
  "Comprend le contenu essentiel de textes complexes et communique avec spontanéité et aisance avec un locuteur natif.",
  "Comprend des textes longs et exigeants, s'exprime spontanément et utilise la langue de façon souple et efficace.",
  "Comprend sans effort pratiquement tout et s'exprime avec précision en distinguant de fines nuances de sens.",
];

const DESCRIPTEURS_DOMAINES: Record<DomaineFaiblesse, { titre: string; extrait: string; detail: string }> = {
  grammaire: {
    titre: "Correction grammaticale",
    extrait: "Utilise correctement des structures simples mais commet encore des erreurs élémentaires, par exemple dans l'accord des temps.",
    detail: "Les temps du passé et les accords sont encore hésitants.",
  },
  vocabulaire: {
    titre: "Étendue du vocabulaire",
    extrait: "Possède un vocabulaire suffisant pour des besoins courants mais recourt souvent à des périphrases.",
    detail: "Le vocabulaire reste limité aux situations du quotidien.",
  },
  comprehension_ecrite: {
    titre: "Compréhension générale de l'écrit",
    extrait: "Comprend des textes factuels simples sur des sujets familiers, avec un degré satisfaisant de compréhension.",
    detail: "Les textes plus longs ou implicites sont mal compris.",
  },
  comprehension_orale: {
    titre: "Compréhension générale de l'oral",
    extrait: "Comprend les points principaux d'un discours clair et standard sur des sujets familiers.",
    detail: "Un débit rapide ou un accent marqué gêne la compréhension.",
  },
  expression_ecrite: {
    titre: "Production écrite générale",
    extrait: "Écrit des textes articulés simplement sur des sujets familiers en liant une série d'éléments courts.",
    detail: "Les phrases sont courtes et peu reliées entre elles.",
  },
  expression_orale: {
    titre: "Production orale générale",
    extrait: "Peut assez aisément mener à bien une description directe et non compliquée de sujets variés.",
    detail: "Le discours manque encore de fluidité et de connecteurs.",
  },
};

/** Descripteur global du niveau atteint, cité comme première source de la justification. */
export function sourceNiveau(cadre: CadreReference, niveaux: readonly string[], niveau: string): SourceReferentiel {
  const index = Math.max(0, niveaux.indexOf(niveau));
  return {
    id: `${cadre}-global-${niveau}`,
    referentiel: cadre,
    niveau,
    titre: `Échelle globale — niveau ${niveau}`,
    extrait: DESCRIPTEURS_GLOBAUX[Math.min(index, DESCRIPTEURS_GLOBAUX.length - 1)],
    url: cadre === "CECRL" ? URL_CECRL : undefined,
  };
}

/** Descripteur et explication d'un point faible, au niveau atteint. */
export function sourceDomaine(cadre: CadreReference, niveau: string, domaine: DomaineFaiblesse) {
  const { titre, extrait, detail } = DESCRIPTEURS_DOMAINES[domaine];
  const source: SourceReferentiel = {
    id: `${cadre}-${domaine}-${niveau}`,
    referentiel: cadre,
    niveau,
    competence: domaine,
    titre,
    extrait,
    url: cadre === "CECRL" ? URL_CECRL : undefined,
  };
  return { source, detail };
}
