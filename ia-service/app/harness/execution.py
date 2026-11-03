"""Harness commun d'exécution des agents.

Le Harness est le point d'entrée unique : il résout l'agent, revalide l'entrée, prépare les outils communs, exécute
sous budget, valide la sortie et retourne toujours une enveloppe standardisée (succès ou erreur). Il ne contient
aucune logique pédagogique.
"""

import asyncio
import logging
import re
import time
from collections.abc import Callable
from typing import Any

from pydantic import ValidationError

from app.core.codes_erreur import CodeErreur
from app.core.erreurs import ErreurAgentInconnu
from app.core.gestionnaire_erreurs import code_pour, reponse_erreur_pour_code
from app.harness.agent import ContexteExecution, OutilsCommuns
from app.harness.registre import RegistreAgents
from app.llm.base import FournisseurLLM
from app.prompts import RegistrePrompts
from app.schemas.commun import (
    CODE_AGENT_PATTERN,
    MetaExecution,
    ReponseAgent,
    ReponseErreur,
    RequeteAgent,
)

logger = logging.getLogger(__name__)

AGENT_INCONNU_AFFICHE = "inconnu"


class Harness:
    """Pipeline commun appliqué à tous les agents."""

    def __init__(
        self,
        registre: RegistreAgents,
        client_llm: FournisseurLLM,
        *,
        registre_prompts: RegistrePrompts | None = None,
        horloge: Callable[[], float] = time.monotonic,
    ) -> None:
        self._registre = registre
        self._client_llm = client_llm
        self._registre_prompts = registre_prompts or RegistrePrompts()
        self._horloge = horloge

    async def executer(
        self,
        code_agent: str,
        requete: RequeteAgent[Any],
        *,
        version_agent: str | None = None,
    ) -> ReponseAgent[Any] | ReponseErreur:
        """Exécuter l'agent demandé et retourner une enveloppe de succès ou d'erreur.

        ``version_agent`` prime sur ``requete.version_agent``. Sans version, la dernière version enregistrée est
        retenue. Toute exception interne est traduite en ``ReponseErreur`` : l'appelant n'a jamais à interpréter une
        exception Python.
        """
        agent_affiche = self._agent_affiche(code_agent)
        version_demandee = version_agent or requete.version_agent

        try:
            definition = self._registre.resoudre(code_agent, version_demandee)
        except ErreurAgentInconnu:
            return self._erreur(requete, agent_affiche, CodeErreur.AGENT_INCONNU)

        try:
            entree = definition.schema_entree.model_validate(requete.entree)
        except ValidationError:
            return self._erreur(requete, agent_affiche, CodeErreur.ENTREE_INVALIDE)

        outils = OutilsCommuns(
            client_llm=self._client_llm,
            registre_prompts=self._registre_prompts,
            horloge=self._horloge,
        )
        contexte = ContexteExecution(
            request_id=requete.request_id,
            contexte=requete.contexte,
            outils=outils,
        )
        debut = self._horloge()

        try:
            async with asyncio.timeout(definition.budget_ms / 1000):
                resultat_brut = await definition.executer(entree, contexte)
        except TimeoutError:
            return self._erreur(requete, agent_affiche, CodeErreur.LLM_TIMEOUT)
        except Exception as exception:
            code = self._code_pour(exception)
            self._journaliser(exception, code, definition.code, requete.request_id)
            return self._erreur(requete, agent_affiche, code)

        try:
            resultat = definition.schema_sortie.model_validate(resultat_brut)
        except ValidationError:
            return self._erreur(requete, agent_affiche, CodeErreur.LLM_REPONSE_INVALIDE)

        duree_ms = max(0, min(600_000, int(round((self._horloge() - debut) * 1000))))
        meta = MetaExecution(
            duree_ms=duree_ms,
            fournisseur=self._client_llm.nom,
            modele=self._client_llm.modele,
            version_corpus=None,
            empreinte_prompt=definition.empreinte_prompt,
        )
        enveloppe = ReponseAgent[definition.schema_sortie]
        return enveloppe(
            request_id=requete.request_id,
            agent=definition.code,
            version_agent=definition.version,
            version_prompt=definition.version_prompt,
            resultat=resultat,
            meta=meta,
        )

    @staticmethod
    def _agent_affiche(code_agent: object) -> str:
        """Ne recopier que les identifiants valides : une valeur libre ne peut pas falsifier l'enveloppe d'erreur."""
        if (
            isinstance(code_agent, str)
            and len(code_agent) <= 32
            and re.fullmatch(CODE_AGENT_PATTERN, code_agent) is not None
        ):
            return code_agent
        return AGENT_INCONNU_AFFICHE

    @staticmethod
    def _erreur(requete: RequeteAgent[Any], agent: str, code: CodeErreur) -> ReponseErreur:
        return reponse_erreur_pour_code(requete.request_id, agent, code)

    @staticmethod
    def _code_pour(exception: BaseException) -> CodeErreur:
        """Un agent qui produit un objet hors schéma est une sortie LLM inexploitable, pas un bug interne."""
        if isinstance(exception, ValidationError):
            return CodeErreur.LLM_REPONSE_INVALIDE
        return code_pour(exception)

    @staticmethod
    def _journaliser(exception: BaseException, code: CodeErreur, code_agent: str, request_id: object) -> None:
        """Journaliser sans contenu sensible : le code et l'identifiant technique suffisent au diagnostic."""
        if code is CodeErreur.ERREUR_INTERNE:
            logger.exception("Erreur inattendue de l'agent %s (request_id=%s)", code_agent, request_id)
        else:
            logger.warning("Erreur %s de l'agent %s (request_id=%s)", code.value, code_agent, request_id)
