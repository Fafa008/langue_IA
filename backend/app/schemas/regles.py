"""Règles de saisie, identiques à celles du frontend (frontend/src/lib/validation, lib/password, lib/saisie).

Le frontend les applique déjà ; le backend les revérifie, car un appel direct à l'API ne passe pas par l'interface.
Les messages d'erreur (422) sont affichés tels quels par le frontend.
"""

import re
from datetime import date

from pydantic_core import PydanticCustomError

EMAIL_PATTERN = re.compile(
    r"^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$"
)
EMAIL_MAX_LONGUEUR = 254
# Lettres (accents compris), séparées par un espace, un tiret ou une apostrophe : « Jean-Pierre », « N'Diaye »
NOM_PATTERN = re.compile(r"^[^\W\d_]+(?:[ '’-][^\W\d_]+)*$")
MOT_DE_PASSE_LONGUEUR_MIN = 8
TELEPHONE_PATTERN = re.compile(r"^0\d{9}$")
CODE_LANGUE_PATTERN = re.compile(r"^[a-z]{2,3}$")
NIVEAU_CODE_MAX_LONGUEUR = 20


def erreur(message: str) -> PydanticCustomError:
    """Erreur de validation dont le message est affiché tel quel (sans le préfixe « Value error, »)."""
    return PydanticCustomError("valeur_invalide", message)


def normaliser_espaces(valeur: str) -> str:
    """«  Rova   Marie » → « Rova Marie »"""
    return " ".join(valeur.split())


def valider_email(valeur: str) -> str:
    email = valeur.strip().lower()
    if not email:
        raise erreur("L'adresse e-mail est requise.")
    if len(email) > EMAIL_MAX_LONGUEUR or not EMAIL_PATTERN.match(email):
        raise erreur("Adresse e-mail invalide.")
    return email


def valider_nom_personne(valeur: str, champ: str) -> str:
    nom = normaliser_espaces(valeur)
    if not nom:
        raise erreur(f"Le {champ} est requis.")
    if not NOM_PATTERN.match(nom):
        raise erreur(f"Le {champ} ne doit contenir que des lettres, espaces, tirets ou apostrophes.")
    return nom


def valider_mot_de_passe(valeur: str) -> str:
    """Règles obligatoires du frontend : 8 caractères, une majuscule et une minuscule, un chiffre."""
    if len(valeur) < MOT_DE_PASSE_LONGUEUR_MIN:
        raise erreur(f"Le mot de passe doit contenir au moins {MOT_DE_PASSE_LONGUEUR_MIN} caractères.")
    if not (re.search(r"[a-z]", valeur) and re.search(r"[A-Z]", valeur)):
        raise erreur("Le mot de passe doit contenir une majuscule et une minuscule.")
    if not re.search(r"\d", valeur):
        raise erreur("Le mot de passe doit contenir un chiffre.")
    return valeur


def normaliser_telephone(valeur: str | None) -> str | None:
    """Téléphone facultatif, enregistré au format malgache local « 034 12 345 67 ».

    Un numéro international (« +261 34 12 345 67 ») est ramené au format local.
    """
    if valeur is None:
        return None
    chiffres = re.sub(r"\D", "", valeur)
    if not chiffres:
        return None
    if chiffres.startswith("261") and len(chiffres) == 12:
        chiffres = "0" + chiffres[3:]
    if not TELEPHONE_PATTERN.match(chiffres):
        raise erreur("Numéro de téléphone invalide : 10 chiffres, au format 030 00 000 00.")
    return f"{chiffres[:3]} {chiffres[3:5]} {chiffres[5:8]} {chiffres[8:]}"


def valider_date_naissance(valeur: date) -> date:
    aujourd_hui = date.today()
    if valeur > aujourd_hui:
        raise erreur("La date de naissance ne peut pas être dans le futur.")
    if aujourd_hui.year - valeur.year > 120:
        raise erreur("Date de naissance invalide.")
    return valeur


def valider_libelle_langue(valeur: str) -> str:
    libelle = normaliser_espaces(valeur)
    if not libelle:
        raise erreur("La désignation est requise.")
    if not NOM_PATTERN.match(libelle):
        raise erreur("La désignation ne doit contenir que des lettres, espaces, tirets ou apostrophes.")
    return libelle


def valider_code_langue(valeur: str) -> str:
    """Code ISO 639 enregistré en minuscules : « FR » → « fr »."""
    code = valeur.strip().lower()
    if not code:
        raise erreur("Le code est requis.")
    if not CODE_LANGUE_PATTERN.match(code):
        raise erreur("Le code doit contenir 2 ou 3 lettres (code ISO, ex. FR).")
    return code


def valider_code_niveau(valeur: str) -> str:
    """« hsk   3 » → « HSK 3 »"""
    code = normaliser_espaces(valeur).upper()
    if not code:
        raise erreur("Le code est requis.")
    if len(code) > NIVEAU_CODE_MAX_LONGUEUR:
        raise erreur(f"Le code compte {NIVEAU_CODE_MAX_LONGUEUR} caractères au maximum.")
    return code


def valider_libelle_requis(valeur: str) -> str:
    libelle = normaliser_espaces(valeur)
    if not libelle:
        raise erreur("Le libellé est requis.")
    return libelle
