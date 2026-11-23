"""Tests des clés Redis de la mémoire courte : identifiant de session toujours présent."""

from uuid import UUID

import pytest

from app.core.erreurs import ErreurEntreeInvalide
from app.memory import clefs
from app.memory.chargeutile import ChargeMemoireLongTerme

SESSION = "session-42"
MESSAGE_ID = UUID("0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d")


@pytest.mark.parametrize("valeur", ["", "   ", "a:b", "session/42", "x" * 65, "é"])
def test_identifiant_session_invalide_refuse(valeur: str) -> None:
    with pytest.raises(ErreurEntreeInvalide):
        clefs.valider_identifiant_session(valeur)


def test_identifiant_session_normalise() -> None:
    assert clefs.valider_identifiant_session(f"  {SESSION}  ") == SESSION


def test_toutes_les_cles_contiennent_la_session() -> None:
    identifiant = clefs.valider_identifiant_session(SESSION)
    generated = [
        clefs.cle_tours(identifiant),
        clefs.cle_summary(identifiant),
        clefs.cle_traduction(identifiant, MESSAGE_ID),
    ]

    assert generated == [
        "session:session-42:turns",
        "session:session-42:summary",
        f"session:session-42:traduction:{MESSAGE_ID}",
    ]
    assert all(clefs.est_cle_session(cle) for cle in generated)


def test_cle_sans_identifiant_session_refusee() -> None:
    assert not clefs.est_cle_session("autre:session-42:turns")
    assert not clefs.est_cle_session("session::turns")
    assert not clefs.est_cle_session("session:session-42")


def test_cle_traduction_accepte_uuid_et_chaine() -> None:
    assert clefs.cle_traduction(SESSION, MESSAGE_ID) == clefs.cle_traduction(SESSION, str(MESSAGE_ID))
    with pytest.raises(ErreurEntreeInvalide):
        clefs.cle_traduction(SESSION, "   ")


def test_charge_utile_long_terme_reste_cote_backend() -> None:
    charge = ChargeMemoireLongTerme(
        profil={"profil_id": "profil-1", "code_langue": "en", "niveau_effectif": "B1"},
        session={
            "identifiant_session": SESSION,
            "nombre_tours": 4,
            "phase_atteinte": "activation",
            "resume": "Quatre tours de conversation en anglais.",
        },
    )

    assert charge.profil.niveau_effectif == "B1"
    assert charge.session.identifiant_session == SESSION
    assert charge.erreurs == []
