"""Persistance de la mémoire long terme du chat (US-IA-CHAT-04).

Ce module est le seul à écrire les tables de mémoire pédagogique. Il reçoit une charge utile déjà validée par le
miroir Pydantic du contrat IA et l'enregistre dans la transaction ouverte par l'orchestrateur : aucune donnée
personnelle n'est ajoutée, le profil reste pseudonyme et les erreurs sont agrégées par type et par extrait.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.chatbot import ErreurRecurrenteChatbot, ProfilMemoireChatbot, SessionMemoireChatbot
from app.schemas.ia import ChargeMemoireLongTermeIA

logger = logging.getLogger(__name__)


def identifiant_profil(id_user: int) -> str:
    """Identifiant pseudonyme stable, dérivé de la clé secrète du backend (jamais transmis en clair)."""
    message = f"apprenant:{id_user}".encode()
    return hmac.new(get_settings().secret_key.encode("utf-8"), message, hashlib.sha256).hexdigest()[:32]


def _date_occurrence(texte: str) -> datetime:
    """Convertir la date envoyée par l'IA, avec repli sur l'heure courante si elle est inexploitable."""
    try:
        date = datetime.fromisoformat(texte)
    except ValueError:
        return datetime.now(UTC)
    if date.tzinfo is None:
        return date.replace(tzinfo=UTC)
    return date


def persister_charge(db: Session, id_user: int, charge: ChargeMemoireLongTermeIA) -> None:
    """Créer ou mettre à jour le profil, les erreurs récurrentes et le bilan de session."""
    # L'identifiant pseudonyme appartient au backend : une valeur renvoyée par l'IA n'est jamais persistée telle
    # quelle, afin qu'un champ inattendu ne puisse devenir une donnée personnelle en base.
    profil_id = identifiant_profil(id_user)
    profil = db.scalar(select(ProfilMemoireChatbot).where(ProfilMemoireChatbot.id_apprenant == id_user))
    if profil is None:
        profil = ProfilMemoireChatbot(id_apprenant=id_user, profil_id=profil_id)
        db.add(profil)
    else:
        profil.profil_id = profil_id
    profil.code_langue = charge.profil.code_langue
    profil.niveau_effectif = charge.profil.niveau_effectif
    db.flush()

    for erreur in charge.erreurs:
        date = _date_occurrence(erreur.derniere_occurrence)
        existante = db.scalar(
            select(ErreurRecurrenteChatbot).where(
                ErreurRecurrenteChatbot.id_profil == profil.id_profil,
                ErreurRecurrenteChatbot.type == erreur.type,
                ErreurRecurrenteChatbot.erreur == erreur.erreur,
            )
        )
        if existante is None:
            db.add(
                ErreurRecurrenteChatbot(
                    id_profil=profil.id_profil,
                    type=erreur.type,
                    erreur=erreur.erreur,
                    frequence=erreur.frequence,
                    date_derniere_occurrence=date,
                )
            )
            continue
        existante.frequence = min(10_000, existante.frequence + erreur.frequence)
        if date > existante.date_derniere_occurrence:
            existante.date_derniere_occurrence = date

    bilan = db.scalar(
        select(SessionMemoireChatbot).where(
            SessionMemoireChatbot.id_apprenant == id_user,
            SessionMemoireChatbot.identifiant_session == charge.session.identifiant_session,
        )
    )
    if bilan is None:
        db.add(
            SessionMemoireChatbot(
                id_apprenant=id_user,
                identifiant_session=charge.session.identifiant_session,
                nombre_tours=charge.session.nombre_tours,
                phase_atteinte=charge.session.phase_atteinte,
                resume=charge.session.resume,
            )
        )
    else:
        bilan.nombre_tours = charge.session.nombre_tours
        bilan.phase_atteinte = charge.session.phase_atteinte
        bilan.resume = charge.session.resume
    logger.info(
        "memoire_chatbot_persistee erreurs=%d tours=%d",
        len(charge.erreurs),
        charge.session.nombre_tours,
    )
