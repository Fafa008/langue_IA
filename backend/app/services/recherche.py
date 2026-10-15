"""Recherche texte insensible à la casse et aux accents (extension PostgreSQL unaccent)."""

import unicodedata

from sqlalchemy import ColumnElement, func, or_


def sans_accents(texte: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texte) if unicodedata.category(c) != "Mn")


def contient(terme: str, *colonnes) -> ColumnElement[bool]:
    """« coreen » trouve « Coréen » ; les caractères % et _ saisis sont cherchés tels quels."""
    motif = sans_accents(terme.strip().lower()).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return or_(*(func.unaccent(func.lower(c)).like(f"%{motif}%", escape="\\") for c in colonnes))
