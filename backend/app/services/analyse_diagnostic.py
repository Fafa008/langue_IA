"""Orchestration de l'analyse IA d'une tentative de diagnostic (PRE-05).

Le scoring déterministe reste la seule autorité sur le score et le niveau. Cette couche ajoute une analyse
**best-effort** : elle construit la requête, appelle le service IA hors de toute connexion PostgreSQL, valide la
réponse à la frontière et persiste l'enveloppe. Toute panne dégrade en résultat partiel : la clôture du test ne doit
jamais échouer à cause de l'IA.

Garde-fous P0 :

- langue hors du référentiel IA (``fr, en, zh, it, de``) ou niveau hors référentiel : aucun appel ;
- aucune réponse exploitable : aucun appel ;
- compétence de question inconnue : la réponse est ignorée plutôt que traduite arbitrairement ;
- énoncé de question transmis seulement comme contexte pédagogique pour la recherche documentaire ;
- deuxième clôture : l'analyse déjà persistée est réutilisée, sans nouvel appel facturé.
"""

import logging
import unicodedata
from dataclasses import dataclass
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Question, Reponse, StatutDiagnostic, TestDiagnostic
from app.schemas.diagnostic import CompetenceResultatOut, PointFaibleOut
from app.schemas.ia import (
    NIVEAUX_IA,
    VERSION_AGENT_DIAGNOSTIC,
    ContexteApprenantIA,
    EntreeDiagnosticIA,
    PreuveDiagnosticIA,
    ReponseDiagnosticIA,
    RequeteDiagnosticIA,
    ResultatDiagnosticIA,
)
from app.services.ia import ErreurServiceIA, evaluer_diagnostic

logger = logging.getLogger(__name__)

LANGUES_IA = frozenset({"fr", "en", "zh", "it", "de"})
COMPETENCES_IA = ("grammaire", "lecture", "ecoute", "ecrit", "oral")
CONTENU_REPONSE_MAX = 5000
ENONCE_MAX = 2000

# Clés normalisées (minuscules, sans accents) vers les cinq compétences attendues par le service IA.
_ALIAS_COMPETENCES = {
    "grammaire": "grammaire",
    "grammar": "grammaire",
    "lecture": "lecture",
    "comprehension ecrite": "lecture",
    "reading": "lecture",
    "ecoute": "ecoute",
    "comprehension orale": "ecoute",
    "listening": "ecoute",
    "ecrit": "ecrit",
    "expression ecrite": "ecrit",
    "writing": "ecrit",
    "oral": "oral",
    "expression orale": "oral",
    "speaking": "oral",
}


@dataclass(frozen=True)
class AnalyseDiagnostic:
    """Analyse exploitable par le contrat public, une fois la réponse IA validée."""

    competences: list[CompetenceResultatOut]
    points_faibles: list[PointFaibleOut]
    phase_assimil: str


@dataclass(frozen=True)
class _Ligne:
    """Réponse et question déchargées de la session avant l'appel HTTP."""

    id_question: int
    competence: str
    type_reponse: str
    reponse: str
    correcte: str | None
    enonce: str | None


def _normaliser_competence(valeur: str) -> str | None:
    """Ramener un libellé libre de la base vers une compétence du contrat IA, ou ``None`` si inconnu."""
    sans_accent = unicodedata.normalize("NFKD", valeur)
    sans_accent = "".join(caractere for caractere in sans_accent if not unicodedata.combining(caractere))
    cle = " ".join(sans_accent.casefold().split())
    return _ALIAS_COMPETENCES.get(cle)


def _charger_lignes(db: Session, id_tentative: int) -> list[_Ligne]:
    """Lire les réponses et leurs questions, puis retourner des valeurs simples détachées de la session."""
    lignes = db.execute(
        select(
            Question.id_question.label("id_question"),
            Question.competence.label("competence"),
            Question.type_reponse.label("type_reponse"),
            Reponse.reponse_fournie.label("reponse"),
            Question.reponse_correcte.label("correcte"),
            Question.enonce.label("enonce"),
        )
        .select_from(Reponse)
        .join(Question, Question.id_question == Reponse.id_question)
        .where(Reponse.id_tentative == id_tentative)
        .order_by(Question.id_question)
    ).mappings()
    return [
        _Ligne(
            id_question=ligne["id_question"],
            competence=ligne["competence"],
            type_reponse=ligne["type_reponse"],
            reponse=ligne["reponse"],
            correcte=ligne["correcte"],
            enonce=(ligne["enonce"] or "").strip()[:ENONCE_MAX] or None,
        )
        for ligne in lignes
    ]


def _calculer_competences(lignes: list[_Ligne]) -> list[CompetenceResultatOut]:
    """Compter les bonnes réponses des seules questions à choix, compétence par compétence.

    Les questions à réponse libre ne sont pas corrigées de façon déterministe : les inclure afficherait un score
    trompeur. Le contrat accepte une liste partielle.
    """
    compteurs: dict[str, list[int]] = {competence: [0, 0] for competence in COMPETENCES_IA}
    for ligne in lignes:
        if ligne.type_reponse != "choix":
            continue
        competence = _normaliser_competence(ligne.competence)
        if competence is None:
            continue
        compteurs[competence][1] += 1
        if ligne.correcte is not None and ligne.reponse == ligne.correcte:
            compteurs[competence][0] += 1
    return [
        CompetenceResultatOut(competence=competence, score=score, total=total)
        for competence, (score, total) in compteurs.items()
        if total > 0
    ]


def _preparer(tentative: TestDiagnostic, lignes: list[_Ligne]) -> RequeteDiagnosticIA | None:
    """Construire la requête IA, ou ``None`` quand un garde-fou impose un résultat partiel."""
    code_langue = tentative.langue.code
    if code_langue not in LANGUES_IA:
        logger.info("Analyse IA ignorée : langue non supportée (tentative=%s)", tentative.id_test)
        return None

    referentiel = "HSK" if code_langue == "zh" else "CECRL"
    niveau = tentative.niveau.code
    if niveau not in NIVEAUX_IA[referentiel]:
        logger.info("Analyse IA ignorée : niveau hors référentiel (tentative=%s)", tentative.id_test)
        return None

    if tentative.score is None:
        return None

    reponses: list[PreuveDiagnosticIA] = []
    for ligne in lignes:
        competence = _normaliser_competence(ligne.competence)
        if competence is None:
            logger.warning("Analyse IA : réponse ignorée, compétence inconnue (tentative=%s)", tentative.id_test)
            continue
        reponses.append(
            PreuveDiagnosticIA(
                id_question=str(ligne.id_question),
                competence=competence,
                type_reponse=ligne.type_reponse,
                contenu=ligne.reponse[:CONTENU_REPONSE_MAX] or " ",
                enonce=ligne.enonce,
            )
        )

    if not reponses:
        logger.info("Analyse IA ignorée : aucune réponse exploitable (tentative=%s)", tentative.id_test)
        return None

    return RequeteDiagnosticIA(
        request_id=uuid4(),
        # Version explicite : un désalignement avec le service IA échoue au lieu d'être masqué (T5).
        version_agent=VERSION_AGENT_DIAGNOSTIC,
        contexte=ContexteApprenantIA(
            code_langue=code_langue,
            referentiel=referentiel,
            niveau_preliminaire=niveau,
        ),
        entree=EntreeDiagnosticIA(
            reponses=reponses,
            score_preliminaire=float(tentative.score),
        ),
    )


def _preuve_directe(domaine: str, preuve: PreuveDiagnosticIA) -> bool:
    """Miroir backend de ``preuve_directe`` du service IA : une réponse à choix ne prouve rien seule."""
    production = preuve.type_reponse in ("texte", "audio")
    if domaine in ("grammaire", "vocabulaire"):
        return production
    if domaine == "expression_ecrite":
        return preuve.competence == "ecrit" and preuve.type_reponse == "texte"
    if domaine == "expression_orale":
        return preuve.competence == "oral" and preuve.type_reponse == "audio"
    if domaine == "comprehension_ecrite":
        return preuve.competence == "lecture" and production
    if domaine == "comprehension_orale":
        return preuve.competence == "ecoute" and production
    return False


def verifier_reponse_diagnostic(enveloppe: ReponseDiagnosticIA, requete: RequeteDiagnosticIA) -> bool:
    """Vérifier qu'une enveloppe valide au sens Pydantic répond bien à *cette* requête.

    ``extra="forbid"`` refuse déjà les champs inconnus ; ce contrôle complète la frontière de confiance sur les
    réponses structurellement valides mais incohérentes (langue, niveau, preuve citée, écart recalculé). Il suit les
    mêmes règles que ``ResultatDiagnostic.verifier_coherence`` côté IA : les deux services échangent le même contrat
    (exemple partagé ``contrats/ia/diagnostic-evaluer/``), sans partager de code.
    """
    if enveloppe.request_id != requete.request_id or enveloppe.agent != "diagnostic":
        return False
    resultat = enveloppe.resultat
    contexte = requete.contexte
    referentiel_attendu = "HSK" if contexte.code_langue == "zh" else "CECRL"
    if (
        resultat.code_langue != contexte.code_langue
        or resultat.referentiel != contexte.referentiel
        or resultat.referentiel != referentiel_attendu
        or resultat.niveau_preliminaire != contexte.niveau_preliminaire
    ):
        return False

    niveaux = NIVEAUX_IA[referentiel_attendu]
    if resultat.niveau_estime not in niveaux or resultat.niveau_preliminaire not in niveaux:
        return False
    ecart = niveaux.index(resultat.niveau_estime) - niveaux.index(resultat.niveau_preliminaire)
    if resultat.ecart_avec_niveau_preliminaire != ecart:
        return False
    if resultat.score_confiance == 0.0 and resultat.points_faibles:
        return False

    preuves = {preuve.id_question: preuve for preuve in requete.entree.reponses}
    if len(preuves) != len(requete.entree.reponses):
        return False
    domaines: set[str] = set()
    for point in resultat.points_faibles:
        preuve = preuves.get(point.id_question)
        if preuve is None or point.domaine in domaines or not _preuve_directe(point.domaine, preuve):
            return False
        domaines.add(point.domaine)
    if resultat.phase_assimil == "activation" and not any(
        preuve.type_reponse in ("texte", "audio") for preuve in requete.entree.reponses
    ):
        return False
    return True


def _analyser_document(document: dict) -> AnalyseDiagnostic:
    """Relire l'enveloppe persistée et produire les champs du contrat public."""
    resultat = ResultatDiagnosticIA.model_validate(document["resultat"])
    return AnalyseDiagnostic(
        competences=[],
        points_faibles=[
            PointFaibleOut(domaine=point.domaine, detail=point.justification) for point in resultat.points_faibles
        ],
        phase_assimil=resultat.phase_assimil,
    )


def analyser_tentative(id_tentative: int) -> AnalyseDiagnostic | None:
    """Analyser une tentative terminée, sans jamais bloquer la réponse HTTP.

    L'appel HTTP se fait entre deux sessions : aucune connexion PostgreSQL n'est immobilisée pendant l'attente du
    service IA. L'analyse déjà persistée est retournée telle quelle, ce qui rend la clôture idempotente.
    """
    with SessionLocal() as db:
        tentative = db.scalar(select(TestDiagnostic).where(TestDiagnostic.id_test == id_tentative))
        if tentative is None or tentative.statut != StatutDiagnostic.TERMINE:
            return None
        lignes = _charger_lignes(db, id_tentative)
        if tentative.analyse_ia:
            analyse = _analyser_document(tentative.analyse_ia)
            return AnalyseDiagnostic(
                competences=_calculer_competences(lignes),
                points_faibles=analyse.points_faibles,
                phase_assimil=analyse.phase_assimil,
            )
        requete = _preparer(tentative, lignes)

    if requete is None:
        return None

    try:
        enveloppe = evaluer_diagnostic(requete)
    except ErreurServiceIA as erreur:
        logger.warning("Analyse IA indisponible (tentative=%s, code=%s)", id_tentative, erreur.code)
        return None
    if not verifier_reponse_diagnostic(enveloppe, requete):
        logger.warning("Analyse IA incohérente avec la requête (tentative=%s)", id_tentative)
        return None

    document = enveloppe.model_dump(mode="json")
    with SessionLocal() as db:
        tentative = db.scalar(select(TestDiagnostic).where(TestDiagnostic.id_test == id_tentative).with_for_update())
        if tentative is None:
            return None
        if tentative.analyse_ia is None:
            tentative.analyse_ia = document
            db.commit()
        else:
            document = tentative.analyse_ia

    analyse = _analyser_document(document)
    return AnalyseDiagnostic(
        competences=_calculer_competences(lignes),
        points_faibles=analyse.points_faibles,
        phase_assimil=analyse.phase_assimil,
    )
