"""Contenu de démonstration du parcours : leçons 1 à 7 (anglais, A1), chargées par `app.seed` si SEED_DEMO=true.

Chaque leçon compte trois exercices. Leur rang fixe la pondération du score de leçon (docs/api/contrat-frontend.md,
« Avancement de la leçon ») : rang 1 compréhension QCM (30), rang 2 grammaire QCM (30), rang 3 rédaction (40). La
difficulté croît avec le rang : le rattachement se fait dans cet ordre (``exercices_de_lecon``).

ATTENTION : ce contenu est un premier jet, à relire par l'équipe pédagogique avant toute utilisation hors démo.
"""

import json
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Exercice, Langue, Niveau, TypeExercice


@dataclass(frozen=True)
class ExerciceDemo:
    type: TypeExercice
    difficulte: int
    contenu: dict[str, Any] = field(repr=False)


def _qcm(
    type_: TypeExercice,
    difficulte: int,
    intitule: str,
    enonce: str,
    choix: list[str],
    bonne: str,
    explication: str,
    consigne: str = "Choisissez la bonne réponse.",
) -> ExerciceDemo:
    return ExerciceDemo(
        type=type_,
        difficulte=difficulte,
        contenu={
            "format": "choix",
            "intitule": intitule,
            "consigne": consigne,
            "enonce": enonce,
            "choix": choix,
            "reponses": [bonne],
            "explication": explication,
        },
    )


def _redaction(difficulte: int, intitule: str, consigne: str, enonce: str, mots_minimum: int = 10) -> ExerciceDemo:
    return ExerciceDemo(
        type=TypeExercice.GRAMMAIRE,
        difficulte=difficulte,
        contenu={
            "format": "redaction",
            "intitule": intitule,
            "consigne": consigne,
            "enonce": enonce,
            "mots_minimum": mots_minimum,
        },
    )


# Numéro de leçon → ses trois exercices, dans l'ordre des rangs 1, 2, 3.
EXERCICES_DEMO_PAR_LECON: dict[int, tuple[ExerciceDemo, ...]] = {
    1: (
        _qcm(
            TypeExercice.COMPREHENSION,
            1,
            "Se présenter",
            "« Hello, I'm Tom. I am from London. » Where is Tom from?",
            ["London", "Paris", "Madrid"],
            "London",
            "« I am from London » : Tom vient de Londres.",
            consigne="Lisez la phrase et choisissez la bonne réponse.",
        ),
        _qcm(
            TypeExercice.GRAMMAIRE,
            2,
            "Le verbe être",
            "I ___ from France.",
            ["am", "is", "are"],
            "am",
            "Avec « I », on utilise « am ».",
            consigne="Choisissez la forme correcte du verbe être.",
        ),
        _redaction(
            3,
            "Se présenter par écrit",
            "Écrivez trois phrases pour vous présenter : votre prénom, votre ville et votre métier.",
            "Introduce yourself to a new friend.",
        ),
    ),
    2: (
        _qcm(
            TypeExercice.COMPREHENSION,
            1,
            "Demander un nom",
            "« What's your name? » asks for ___.",
            ["a name", "an address", "a price"],
            "a name",
            "« What's your name? » demande le nom de la personne.",
        ),
        _qcm(
            TypeExercice.GRAMMAIRE,
            2,
            "Le nom et le verbe être",
            "My name ___ Lea.",
            ["is", "are", "am"],
            "is",
            "Avec « name » (singulier), on dit « is ».",
        ),
        _redaction(
            3,
            "Saluer un nouveau camarade",
            "Écrivez un court message pour saluer un nouveau camarade et lui demander son nom.",
            "Greet a new classmate and ask for his or her name.",
        ),
    ),
    3: (
        _qcm(
            TypeExercice.COMPREHENSION,
            1,
            "Parler de son âge",
            "« I am twenty years old. » How old is the speaker?",
            ["20", "12", "30"],
            "20",
            "« Twenty » signifie vingt.",
        ),
        _qcm(
            TypeExercice.GRAMMAIRE,
            2,
            "Parler de son âge (2)",
            "I ___ twenty years old.",
            ["am", "have", "is"],
            "am",
            "On dit « I am » (je suis) pour l'âge, pas « I have ».",
        ),
        _redaction(
            3,
            "Parler de soi",
            "Écrivez trois phrases sur votre âge et la ville où vous habitez.",
            "Write three sentences about your age and where you live.",
        ),
    ),
    4: (
        _qcm(
            TypeExercice.COMPREHENSION,
            1,
            "La famille",
            "« This is my brother, Paul. » Who is Paul?",
            ["the speaker's brother", "the speaker's father", "the speaker"],
            "the speaker's brother",
            "« My brother » signifie « mon frère ».",
        ),
        _qcm(
            TypeExercice.GRAMMAIRE,
            2,
            "Les adjectifs possessifs",
            "This is ___ sister.",
            ["my", "I", "me"],
            "my",
            "Devant un nom, on utilise l'adjectif possessif « my ».",
        ),
        _redaction(
            3,
            "Décrire sa famille",
            "Décrivez votre famille en quatre phrases.",
            "Describe your family in four sentences.",
        ),
    ),
    5: (
        _qcm(
            TypeExercice.COMPREHENSION,
            1,
            "Une journée",
            "« I get up at seven and I have breakfast at half past seven. » When does the speaker have breakfast?",
            ["at half past seven", "at seven", "at eight"],
            "at half past seven",
            "« Half past seven » signifie sept heures et demie.",
        ),
        _qcm(
            TypeExercice.GRAMMAIRE,
            2,
            "La troisième personne",
            "She ___ coffee every morning.",
            ["drinks", "drink", "drinking"],
            "drinks",
            "À la troisième personne du singulier, on ajoute un « s » : « she drinks ».",
        ),
        _redaction(
            3,
            "Décrire sa journée",
            "Décrivez votre journée type en cinq phrases.",
            "Describe your typical day in five sentences.",
        ),
    ),
    6: (
        _qcm(
            TypeExercice.COMPREHENSION,
            1,
            "Demander son chemin",
            "« Go straight, then turn left at the bank. » What do you do first?",
            ["Go straight", "Turn right", "Stop at the bank"],
            "Go straight",
            "On commence par « go straight » (aller tout droit), puis on tourne à gauche.",
        ),
        _qcm(
            TypeExercice.GRAMMAIRE,
            2,
            "Il y a",
            "Is there ___ bus stop near here?",
            ["a", "an", "some"],
            "a",
            "« Bus stop » commence par une consonne : on dit « a bus stop ».",
        ),
        _redaction(
            3,
            "Donner un itinéraire",
            "Écrivez l'itinéraire de la gare jusqu'à chez vous.",
            "Write directions from the train station to your home.",
        ),
    ),
    7: (
        _qcm(
            TypeExercice.COMPREHENSION,
            1,
            "Les loisirs",
            "« I love swimming, but I don't like running. » What does the speaker like?",
            ["swimming", "running", "cooking"],
            "swimming",
            "« I love swimming » : la personne aime la natation.",
        ),
        _qcm(
            TypeExercice.GRAMMAIRE,
            2,
            "Like et la forme en -ing",
            "She likes ___ books.",
            ["reading", "read", "reads"],
            "reading",
            "Après « like », on utilise la forme en « -ing » : « likes reading ».",
        ),
        _redaction(
            3,
            "Parler de ses loisirs",
            "Écrivez un paragraphe sur un loisir que vous aimez et pourquoi.",
            "Write about one hobby you enjoy and why.",
        ),
    ),
}


def charger_parcours_demo(db: Session) -> int:
    """Ajoute les exercices de démonstration absents ; retourne leur nombre.

    Chaque exercice est rattaché à sa leçon (``numero_lecon``). Idempotent : un exercice dont le contenu est déjà en
    base n'est pas ajouté une seconde fois.
    """
    langue = db.scalar(select(Langue).where(Langue.code == "en"))
    niveau = db.scalar(select(Niveau).where(Niveau.code == "A1"))
    if langue is None or niveau is None:
        raise RuntimeError("Référentiel absent : charger le référentiel avant le contenu de démonstration.")

    creees = 0
    for numero_lecon, exercices in EXERCICES_DEMO_PAR_LECON.items():
        for demo in exercices:
            contenu = json.dumps(demo.contenu, ensure_ascii=False)
            existant = db.scalar(
                select(Exercice.id_exercice).where(
                    Exercice.id_langue == langue.id_langue,
                    Exercice.id_niveau == niveau.id_niveau,
                    Exercice.contenu == contenu,
                )
            )
            if existant is not None:
                continue
            db.add(
                Exercice(
                    type=demo.type,
                    contenu=contenu,
                    difficulte=demo.difficulte,
                    numero_lecon=numero_lecon,
                    langue=langue,
                    niveau=niveau,
                )
            )
            creees += 1
    db.commit()
    return creees
