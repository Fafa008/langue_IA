"""Données de départ, sans doublon si on relance : `python -m app.seed` (lancé au démarrage du conteneur).

- Référentiel, toujours : les 5 langues du centre, les niveaux CECRL et HSK, les formules.
  Les valeurs reprennent celles du frontend en mode simulé (frontend/src/mocks).
- Comptes de démonstration (un par rôle, mot de passe Demo2026), seulement si SEED_DEMO=true :
  ce sont les comptes proposés sur la page de connexion. Jamais en production.
"""

import logging
import os
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hacher_mot_de_passe
from app.models import (
    Abonnement,
    Administrateur,
    Apprenant,
    Formateur,
    Formule,
    Langue,
    Niveau,
    Role,
    StatutAbonnement,
    StatutUtilisateur,
    Utilisateur,
)

logger = logging.getLogger(__name__)

LANGUES = [("fr", "Français"), ("en", "Anglais"), ("zh", "Mandarin"), ("it", "Italien"), ("de", "Allemand")]

CECRL = [
    ("A1", "Débutant"),
    ("A2", "Élémentaire"),
    ("B1", "Intermédiaire"),
    ("B2", "Intermédiaire avancé"),
    ("C1", "Avancé"),
    ("C2", "Maîtrise"),
]
HSK = [
    ("HSK 1", "Mandarin – débutant"),
    ("HSK 2", "Mandarin – élémentaire"),
    ("HSK 3", "Mandarin – intermédiaire"),
    ("HSK 4", "Mandarin – intermédiaire avancé"),
    ("HSK 5", "Mandarin – avancé"),
    ("HSK 6", "Mandarin – maîtrise"),
]

# (libellé, prix mensuel en Ariary, durée en mois, heures, ateliers) : couvrent toutes les langues
FORMULES = [("Simple", 60000, 1, 6, 1), ("Luxe", 100000, 3, 12, 3), ("Premium", 150000, 6, 24, 6)]

MOT_DE_PASSE_DEMO = "Demo2026"
COMPTES_DEMO = [
    (Role.APPRENANT, "Rova", "RAKOTO", "apprenant@digitheque.mg"),
    (Role.FORMATEUR, "Hery", "RANDRIA", "formateur@digitheque.mg"),
    (Role.ADMINISTRATEUR, "Fanja", "RASOA", "admin@digitheque.mg"),
]


def charger_referentiel(db: Session) -> None:
    niveaux: dict[str, Niveau] = {n.code: n for n in db.scalars(select(Niveau))}
    for code, libelle in CECRL + HSK:
        if code not in niveaux:
            niveaux[code] = Niveau(code=code, libelle=libelle)
            db.add(niveaux[code])

    langues = {langue.code: langue for langue in db.scalars(select(Langue))}
    for code, libelle in LANGUES:
        if code not in langues:
            # Mandarin : niveaux HSK ; langues européennes : niveaux CECRL
            ouverts = HSK if code == "zh" else CECRL
            db.add(Langue(code=code, libelle=libelle, niveaux=[niveaux[c] for c, _ in ouverts]))

    existantes = set(db.scalars(select(Formule.libelle)))
    for libelle, prix, duree, heures, ateliers in FORMULES:
        if libelle not in existantes:
            db.add(
                Formule(
                    libelle=libelle, prix_mensuel=prix, duree_mois=duree, quota_heures=heures, quota_ateliers=ateliers
                )
            )
    db.commit()


def charger_comptes_demo(db: Session) -> None:
    for role, prenom, nom, email in COMPTES_DEMO:
        if db.scalar(select(Utilisateur.id_user).where(Utilisateur.email == email)) is not None:
            continue
        utilisateur = Utilisateur(
            prenom=prenom,
            nom=nom,
            email=email,
            mot_de_passe=hacher_mot_de_passe(MOT_DE_PASSE_DEMO),
            role=role,
            statut=StatutUtilisateur.ACTIF,
        )
        if role == Role.APPRENANT:
            anglais = db.scalar(select(Langue).where(Langue.code == "en"))
            formule = db.scalar(select(Formule).where(Formule.libelle == "Luxe"))
            utilisateur.apprenant = Apprenant(date_naissance=date(2000, 5, 1), langues=[anglais] if anglais else [])
            if formule:
                utilisateur.apprenant.abonnements.append(
                    Abonnement(
                        formule=formule,
                        date_debut=date.today(),
                        date_fin=date.today() + timedelta(days=365),
                        statut=StatutAbonnement.ACTIF,
                        quota_heures=formule.quota_heures,
                        quota_ateliers=formule.quota_ateliers,
                    )
                )
        elif role == Role.FORMATEUR:
            enseignees = db.scalars(select(Langue).where(Langue.code.in_(["fr", "en"]))).all()
            utilisateur.formateur = Formateur(
                type_contrat="CDI",
                certifications="DALF C2, habilitation examinateur DELF",
                langues_enseignees=list(enseignees),
            )
        else:
            utilisateur.administrateur = Administrateur(niveau_acces=3)
        db.add(utilisateur)
    db.commit()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    with SessionLocal() as db:
        charger_referentiel(db)
        logger.info("Référentiel chargé : langues, niveaux, formules.")
        if os.getenv("SEED_DEMO", "false").lower() == "true":
            charger_comptes_demo(db)
            logger.info("Comptes de démonstration chargés (mot de passe %s).", MOT_DE_PASSE_DEMO)


if __name__ == "__main__":
    main()
