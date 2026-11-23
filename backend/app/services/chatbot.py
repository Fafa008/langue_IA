"""Orchestration du chat apprenant (US67/US74).

Le backend reste l'autorité : il authentifie, lit le niveau depuis le parcours, applique le quota, appelle le
service IA sans transaction PostgreSQL ouverte, revalide le bloc ``corrections[]`` puis enregistre l'historique de
session et un journal sans texte brut. Aucun contenu n'est journalisé. La ``traduction`` et l'``explication``
françaises sont revalidées avec la réponse du tuteur avant d'être transmises au frontend.
"""

import json
import logging
import time
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models import Exercice, Langue, Niveau, TypeExercice
from app.models.chatbot import JournalChatbot
from app.schemas.chatbot import (
    ChatbotMessageIn,
    ChatbotMessageOut,
    ChatbotSessionSupprimeeOut,
    CorrectionChatbotIn,
    CorrectionChatbotOut,
    CorrectionDetailleeChatbotOut,
    ExerciceCibleChatbotIn,
    ExerciceCibleChatbotOut,
    TraductionChatbotIn,
    TraductionChatbotOut,
)
from app.schemas.ia import (
    ContexteApprenantIA,
    EntreeChatbotIA,
    EntreeClotureIA,
    EntreeExerciceIA,
    EntreeTraductionChatbotIA,
    MessageHistoriqueChatbotIA,
    ProfilMemoireIA,
    RequeteChatbotIA,
    RequeteClotureIA,
    RequeteCorrectionChatbotIA,
    RequeteExerciceIA,
    RequeteTraductionChatbotIA,
    ResultatChatbotIA,
    ResultatCorrectionChatbotIA,
)
from app.services.analyse_diagnostic import LANGUES_IA, NIVEAUX_IA
from app.services.historique_chatbot import ajouter_tours, lire, supprimer
from app.services.ia import (
    ErreurServiceIA,
    clore_session_chatbot,
    corriger_message_chatbot,
    envoyer_message_chatbot,
    generer_exercice_chatbot,
    traduire_message_chatbot,
)
from app.services.lecture_parcours import parcours_en_cours
from app.services.memoire_chatbot import identifiant_profil, persister_charge
from app.services.parcours import niveau_estime, referentiel_de_langue
from app.services.quota_chatbot import QuotaDepasseChatbot, consommer_echange, terminer_session

logger = logging.getLogger(__name__)


class CodeErreurChatbot(StrEnum):
    PARCOURS_INCONNU = "parcours_inconnu"
    LANGUE_NON_PRISE_EN_CHARGE = "langue_non_prise_en_charge"
    QUOTA_DEPASSE = "quota_depasse"
    IA_TIMEOUT = "ia_timeout"
    IA_INDISPONIBLE = "ia_indisponible"
    IA_REPONSE_INVALIDE = "ia_reponse_invalide"


class ErreurChatbot(Exception):
    def __init__(self, code: CodeErreurChatbot) -> None:
        self.code = code
        super().__init__(code.value)


_CODE_IA = {
    "timeout": CodeErreurChatbot.IA_TIMEOUT,
    "indisponible": CodeErreurChatbot.IA_INDISPONIBLE,
    "non_configure": CodeErreurChatbot.IA_INDISPONIBLE,
    "reponse_invalide": CodeErreurChatbot.IA_REPONSE_INVALIDE,
}


def _code_pour_erreur_ia(code: str) -> CodeErreurChatbot:
    if code in _CODE_IA:
        return _CODE_IA[code]
    if code.startswith("http_"):
        return CodeErreurChatbot.IA_INDISPONIBLE
    return CodeErreurChatbot.IA_REPONSE_INVALIDE


def _normaliser(texte: str) -> str:
    return " ".join(texte.split()).casefold()


def verifier_corrections(resultat: ResultatChatbotIA, message: str) -> bool:
    """Les corrections citent le message de l'apprenant et restent au nombre de trois au plus."""
    if len(resultat.corrections) > 3:
        return False
    texte = _normaliser(message)
    return all(_normaliser(correction.extrait) in texte for correction in resultat.corrections)


def envoyer_message(id_user: int, corps: ChatbotMessageIn) -> ChatbotMessageOut:
    """Répondre à un message du chat, ou lever ``ErreurChatbot`` sans exposer de contenu dans les journaux."""
    debut = time.monotonic()
    with SessionLocal() as db:
        parcours = parcours_en_cours(db, id_user)
        if parcours is None:
            raise ErreurChatbot(CodeErreurChatbot.PARCOURS_INCONNU)
        code_langue = parcours.langue.code
        referentiel = referentiel_de_langue(code_langue)
        niveau = niveau_estime(parcours.test_diagnostic).code
        niveau_confirme = parcours.test_diagnostic.niveau_final is not None
        if code_langue not in LANGUES_IA or niveau not in NIVEAUX_IA[referentiel]:
            raise ErreurChatbot(CodeErreurChatbot.LANGUE_NON_PRISE_EN_CHARGE)

        historique = lire(db, id_apprenant=id_user, identifiant_session=corps.identifiant_session)
        try:
            quota = consommer_echange(db, id_apprenant=id_user, identifiant_session=corps.identifiant_session)
        except QuotaDepasseChatbot:
            raise ErreurChatbot(CodeErreurChatbot.QUOTA_DEPASSE) from None
        db.commit()
        quota_restant = max(0, get_settings().chatbot_quota_echanges - quota.nombre_echanges)
        contexte = ContexteApprenantIA(
            code_langue=code_langue,
            referentiel=referentiel,
            niveau_preliminaire=niveau,
            niveau_confirme=niveau_confirme,
        )

    requete = RequeteChatbotIA(
        request_id=uuid4(),
        contexte=contexte,
        entree=EntreeChatbotIA(
            message=corps.message,
            historique=[MessageHistoriqueChatbotIA(role=tour.role, contenu=tour.contenu) for tour in historique],
            identifiant_session=corps.identifiant_session,
        ),
    )
    try:
        enveloppe = envoyer_message_chatbot(requete)
    except ErreurServiceIA as erreur:
        logger.warning("Chat IA indisponible (code=%s)", erreur.code)
        raise ErreurChatbot(_code_pour_erreur_ia(erreur.code)) from None

    resultat = enveloppe.resultat
    if not verifier_corrections(resultat, corps.message):
        logger.warning("Corrections IA incohérentes refusées")
        raise ErreurChatbot(CodeErreurChatbot.IA_REPONSE_INVALIDE)

    duree_ms = max(0, int(round((time.monotonic() - debut) * 1000)))
    with SessionLocal() as db:
        ajouter_tours(
            db,
            id_apprenant=id_user,
            identifiant_session=corps.identifiant_session,
            tours=[("apprenant", corps.message), ("assistant", resultat.reponse)],
        )
        db.add(
            JournalChatbot(
                identifiant_session=corps.identifiant_session,
                scenario=None,
                duree_ms=duree_ms,
                modele=enveloppe.meta.modele,
                version_prompt=enveloppe.version_prompt,
                nombre_corrections=len(resultat.corrections),
            )
        )
        db.commit()

    return ChatbotMessageOut(
        reponse=resultat.reponse,
        corrections=[correction.model_dump() for correction in resultat.corrections],
        traduction=resultat.traduction,
        explication=resultat.explication,
        quota_restant=quota_restant,
        version_prompt=enveloppe.version_prompt,
    )


def _contexte_pour_cloture(id_user: int) -> tuple[ContexteApprenantIA | None, ProfilMemoireIA | None]:
    """Construire le contexte pseudonyme transmis à l'agent de clôture, sans donnée personnelle."""
    with SessionLocal() as db:
        parcours = parcours_en_cours(db, id_user)
        if parcours is None:
            return None, None
        code_langue = parcours.langue.code
        referentiel = referentiel_de_langue(code_langue)
        niveau = niveau_estime(parcours.test_diagnostic).code
        if code_langue not in LANGUES_IA or niveau not in NIVEAUX_IA[referentiel]:
            return None, None
        niveau_confirme = parcours.test_diagnostic.niveau_final is not None
        niveau_effectif = niveau if niveau_confirme else NIVEAUX_IA[referentiel][0]

    contexte = ContexteApprenantIA(
        code_langue=code_langue,
        referentiel=referentiel,
        niveau_preliminaire=niveau,
        niveau_confirme=niveau_confirme,
    )
    profil = ProfilMemoireIA(
        profil_id=identifiant_profil(id_user),
        code_langue=code_langue,
        niveau_effectif=niveau_effectif,
    )
    return contexte, profil


def terminer_session_chat(id_user: int, identifiant_session: str) -> ChatbotSessionSupprimeeOut:
    """Clôturer la session : synthèse IA persistée si possible, puis historique et quota supprimés.

    Une panne du service IA ne bloque jamais la fermeture : les données volatiles sont supprimées et seule la
    mémoire long terme est absente. Le journal anonymisé reste intact dans tous les cas.
    """
    contexte, profil = _contexte_pour_cloture(id_user)
    charge = None
    if contexte is not None and profil is not None:
        requete = RequeteClotureIA(
            request_id=uuid4(),
            contexte=contexte,
            entree=EntreeClotureIA(identifiant_session=identifiant_session, profil=profil),
        )
        try:
            charge = clore_session_chatbot(requete).resultat
        except ErreurServiceIA as erreur:
            logger.warning("Clôture IA indisponible (code=%s) ; mémoire long terme non enregistrée", erreur.code)

    with SessionLocal() as db:
        if charge is not None:
            persister_charge(db, id_user, charge)
        supprimer(db, id_apprenant=id_user, identifiant_session=identifiant_session)
        terminer_session(db, id_apprenant=id_user, identifiant_session=identifiant_session)
        db.commit()
    return ChatbotSessionSupprimeeOut()


def _difficulte(niveau: str, referentiel: str) -> int:
    niveaux = NIVEAUX_IA[referentiel]
    return min(5, niveaux.index(niveau) + 1) if niveau in niveaux else 3


def generer_exercice_cible(id_user: int, corps: ExerciceCibleChatbotIn) -> ExerciceCibleChatbotOut:
    """Demander un exercice ciblé à l'IA et l'enregistrer en brouillon dans la banque du backend."""
    with SessionLocal() as db:
        parcours = parcours_en_cours(db, id_user)
        if parcours is None:
            raise ErreurChatbot(CodeErreurChatbot.PARCOURS_INCONNU)
        code_langue = parcours.langue.code
        referentiel = referentiel_de_langue(code_langue)
        niveau = niveau_estime(parcours.test_diagnostic).code
        if code_langue not in LANGUES_IA or niveau not in NIVEAUX_IA[referentiel]:
            raise ErreurChatbot(CodeErreurChatbot.LANGUE_NON_PRISE_EN_CHARGE)
        niveau_confirme = parcours.test_diagnostic.niveau_final is not None
        contexte = ContexteApprenantIA(
            code_langue=code_langue,
            referentiel=referentiel,
            niveau_preliminaire=niveau,
            niveau_confirme=niveau_confirme,
        )
        niveau_effectif = niveau if niveau_confirme else NIVEAUX_IA[referentiel][0]

    requete = RequeteExerciceIA(
        request_id=uuid4(),
        contexte=contexte,
        entree=EntreeExerciceIA(
            identifiant_session=corps.identifiant_session,
            type_erreur=corps.type_erreur,
            erreur=corps.erreur,
            niveau=niveau_effectif,
        ),
    )
    try:
        resultat = generer_exercice_chatbot(requete).resultat
    except ErreurServiceIA as erreur:
        logger.warning("Exercice ciblé IA indisponible (code=%s)", erreur.code)
        raise ErreurChatbot(_code_pour_erreur_ia(erreur.code)) from None

    if resultat.niveau not in NIVEAUX_IA[referentiel]:
        logger.warning("Niveau d'exercice IA hors référentiel refusé")
        raise ErreurChatbot(CodeErreurChatbot.IA_REPONSE_INVALIDE)

    with SessionLocal() as db:
        langue = db.scalar(select(Langue).where(Langue.code == code_langue))
        niveau_ligne = db.scalar(select(Niveau).where(Niveau.code == resultat.niveau))
        if langue is None or niveau_ligne is None:
            raise ErreurChatbot(CodeErreurChatbot.IA_REPONSE_INVALIDE)
        contenu = json.dumps(
            {
                "format": "redaction",
                "intitule": f"Exercice ciblé — {corps.type_erreur}",
                "consigne": resultat.consigne,
                "enonce": resultat.enonce,
                "mots_minimum": 5,
                "descripteur_id": resultat.descripteur_id,
            },
            ensure_ascii=False,
        )
        exercice = Exercice(
            type=TypeExercice.GRAMMAIRE,
            contenu=contenu,
            difficulte=_difficulte(resultat.niveau, referentiel),
            langue=langue,
            niveau=niveau_ligne,
            numero_lecon=None,
            usage="parcours",
            statut="brouillon",
            origine="systeme:ia_chat",
            auteur="systeme:ia_chat",
            framework=referentiel,
            level=resultat.niveau,
        )
        db.add(exercice)
        db.commit()
        db.refresh(exercice)

    return ExerciceCibleChatbotOut(
        id_exercice=exercice.id_exercice,
        enonce=resultat.enonce,
        consigne=resultat.consigne,
        descripteur_id=resultat.descripteur_id,
        niveau=resultat.niveau,
    )


def _contexte_agent(id_user: int) -> ContexteApprenantIA:
    """Construire le contexte pseudonyme des agents séparés, sans laisser fuir d'identité."""
    with SessionLocal() as db:
        parcours = parcours_en_cours(db, id_user)
        if parcours is None:
            raise ErreurChatbot(CodeErreurChatbot.PARCOURS_INCONNU)
        code_langue = parcours.langue.code
        referentiel = referentiel_de_langue(code_langue)
        niveau = niveau_estime(parcours.test_diagnostic).code
        if code_langue not in LANGUES_IA or niveau not in NIVEAUX_IA[referentiel]:
            raise ErreurChatbot(CodeErreurChatbot.LANGUE_NON_PRISE_EN_CHARGE)
        niveau_confirme = parcours.test_diagnostic.niveau_final is not None

    return ContexteApprenantIA(
        code_langue=code_langue,
        referentiel=referentiel,
        niveau_preliminaire=niveau,
        niveau_confirme=niveau_confirme,
    )


def verifier_corrections_separees(resultat: ResultatCorrectionChatbotIA, message: str) -> bool:
    """Chaque correction séparée doit citer le message de l'apprenant ; au plus trois sont renvoyées."""
    if len(resultat.corrections) > 3:
        return False
    texte = _normaliser(message)
    return all(_normaliser(correction.erreur) in texte for correction in resultat.corrections)


def corriger_message(id_user: int, corps: CorrectionChatbotIn) -> CorrectionChatbotOut:
    """Corriger le dernier message via l'agent dédié ; la conversation avec le tuteur n'est pas interrompue."""
    contexte = _contexte_agent(id_user)
    requete = RequeteCorrectionChatbotIA(
        request_id=uuid4(),
        contexte=contexte,
        entree=EntreeChatbotIA(
            message=corps.message,
            historique=[MessageHistoriqueChatbotIA(role=tour.role, contenu=tour.contenu) for tour in corps.historique],
            identifiant_session=corps.identifiant_session,
        ),
    )
    try:
        enveloppe = corriger_message_chatbot(requete)
    except ErreurServiceIA as erreur:
        logger.warning("Correction chat IA indisponible (code=%s)", erreur.code)
        raise ErreurChatbot(_code_pour_erreur_ia(erreur.code)) from None

    resultat = enveloppe.resultat
    if not verifier_corrections_separees(resultat, corps.message):
        logger.warning("Corrections IA séparées incohérentes refusées")
        raise ErreurChatbot(CodeErreurChatbot.IA_REPONSE_INVALIDE)

    return CorrectionChatbotOut(
        corrections=[
            CorrectionDetailleeChatbotOut(
                type=correction.type,
                extrait=correction.erreur,
                correction=correction.correction,
                explication=correction.explication,
            )
            for correction in resultat.corrections
        ],
        version_prompt=enveloppe.version_prompt,
    )


def traduire_message(id_user: int, corps: TraductionChatbotIn) -> TraductionChatbotOut:
    """Traduire une réponse du tuteur via l'agent dédié, cache IA indexé par ``id_message``."""
    contexte = _contexte_agent(id_user)
    requete = RequeteTraductionChatbotIA(
        request_id=uuid4(),
        contexte=contexte,
        entree=EntreeTraductionChatbotIA(
            identifiant_session=corps.identifiant_session,
            id_message=corps.id_message,
            message=corps.message,
        ),
    )
    try:
        enveloppe = traduire_message_chatbot(requete)
    except ErreurServiceIA as erreur:
        logger.warning("Traduction chat IA indisponible (code=%s)", erreur.code)
        raise ErreurChatbot(_code_pour_erreur_ia(erreur.code)) from None

    resultat = enveloppe.resultat
    if resultat.id_message != corps.id_message:
        logger.warning("Traduction IA avec un identifiant de message incohérent refusée")
        raise ErreurChatbot(CodeErreurChatbot.IA_REPONSE_INVALIDE)

    return TraductionChatbotOut(
        id_message=resultat.id_message,
        traduction=resultat.traduction,
        explication=resultat.explication,
        version_prompt=enveloppe.version_prompt,
    )
