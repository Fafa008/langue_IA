"""Banque de questions de démonstration du test de diagnostic (chargée par `app.seed` si SEED_DEMO=true).

Sans ces questions, une base neuve répond « aucune_question » au lancement du test : la chaîne locale
tourne mais l'apprenant de démonstration ne peut rien faire. Les questions reprennent celles du frontend en
mode simulé (frontend/src/mocks/questions-test.mock.ts) : QCM de grammaire et de vocabulaire, lecture et
écoute. Seules les questions à choix sont chargées : ce sont les seules corrigées par le scoring.
Mandarin, italien, allemand : à fournir par l'équipe pédagogique.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question


@dataclass(frozen=True)
class QuestionDemo:
    niveau: str
    enonce: str
    choix: tuple[str, ...]
    bonne_reponse: int
    competence: str = "grammaire"
    support: str | None = None
    audio_texte: str | None = None


def _q(niveau: str, enonce: str, choix: tuple[str, ...], bonne: int, competence: str = "grammaire") -> QuestionDemo:
    return QuestionDemo(niveau, enonce, choix, bonne, competence)


QUESTIONS_DEMO: dict[str, list[QuestionDemo]] = {
    "en": [
        _q("A1", "She ___ a student.", ("is", "are", "am", "be"), 0),
        _q("A1", "I ___ coffee every morning.", ("drinks", "drink", "am drink", "drunk"), 1),
        _q("A2", "We ___ to the cinema yesterday.", ("go", "goed", "went", "gone"), 2),
        _q("A2", "There isn't ___ milk left.", ("some", "any", "a", "many"), 1),
        _q("A2", 'Choose the opposite of "cheap".', ("expensive", "small", "easy", "early"), 0, "vocabulaire"),
        QuestionDemo(
            "A2",
            "When does Anna want to meet?",
            ("Monday at ten", "Wednesday at ten", "Wednesday at two", "Friday at ten"),
            1,
            "ecoute",
            audio_texte="Hello, this is Anna. I can't come to the meeting on Monday. "
            "Can we meet on Wednesday at ten instead?",
        ),
        _q("B1", "If I ___ more time, I would travel more.", ("have", "had", "would have", "having"), 1),
        _q("B1", "She has lived here ___ 2015.", ("for", "since", "from", "during"), 1),
        _q("B1", "I'm looking ___ my keys. Have you seen them?", ("at", "for", "after", "into"), 1, "vocabulaire"),
        _q(
            "B2",
            "By the time we arrived, the film ___.",
            ("already started", "had already started", "has already started", "was already start"),
            1,
        ),
        _q("B2", "I wish I ___ the answer yesterday.", ("knew", "know", "had known", "would know"), 2),
        QuestionDemo(
            "B2",
            "Why did the company change its policy?",
            ("To reduce costs", "To improve flexibility", "To hire more people", "To expand abroad"),
            1,
            "lecture",
            support="The company introduced flexible working hours after staff feedback showed that commuting "
            "affected productivity.",
        ),
        QuestionDemo(
            "B2",
            "What does the speaker recommend?",
            ("Taking a later train", "Booking in advance", "Travelling by bus", "Working from home"),
            1,
            "ecoute",
            audio_texte="For your train journey, I recommend booking your tickets in advance. Prices are usually "
            "lower, and you will have a better choice of seats.",
        ),
        _q(
            "C1",
            "Hardly ___ the door when the phone rang.",
            ("he had opened", "had he opened", "did he open", "he opened"),
            1,
        ),
        _q(
            "C1",
            "The report, ___ findings were disputed, was withdrawn.",
            ("which", "whose", "of which the", "that"),
            1,
        ),
        _q(
            "C1",
            "The new policy had a ___ effect on sales.",
            ("profound", "deep-seated", "heavy", "tall"),
            0,
            "vocabulaire",
        ),
        _q(
            "C2",
            "Were it not for your help, I ___ the deadline.",
            ("would miss", "would have missed", "had missed", "will miss"),
            1,
        ),
        _q("C2", "She is widely ___ to win the prize.", ("tipped", "tipping", "tip", "tips"), 0),
    ],
    "fr": [
        _q("A1", "Je ___ étudiant.", ("suis", "es", "est", "sommes"), 0),
        _q("A1", "Nous ___ au marché le samedi.", ("vais", "allons", "allez", "vont"), 1),
        _q("A2", "Hier, elle ___ au cinéma.", ("va", "est allée", "irait", "allé"), 1),
        _q("A2", "Il n'y a plus ___ pain.", ("du", "de", "des", "le"), 1),
        _q("A2", "Quel est le contraire de « cher » ?", ("bon marché", "petit", "facile", "tôt"), 0, "vocabulaire"),
        QuestionDemo(
            "A2",
            "Quand Anna veut-elle se voir ?",
            ("Lundi à dix heures", "Mercredi à dix heures", "Mercredi à deux heures", "Vendredi à dix heures"),
            1,
            "ecoute",
            audio_texte="Bonjour, c'est Anna. Je ne peux pas venir à la réunion lundi. "
            "On peut se voir mercredi à dix heures ?",
        ),
        _q(
            "B1",
            "Si j'avais plus de temps, je ___ davantage.",
            ("voyagerai", "voyagerais", "voyageais", "voyagé"),
            1,
        ),
        _q("B1", "Elle habite ici ___ 2015.", ("pendant", "depuis", "il y a", "dans"), 1),
        _q("B1", "Je ___ mes clés. Tu les as vues ?", ("cherche", "regarde", "trouve", "attends"), 0, "vocabulaire"),
        _q("B2", "Quand nous sommes arrivés, le film ___ déjà commencé.", ("avait", "a", "était", "aura"), 0),
        _q("B2", "Il faut que tu ___ patient.", ("es", "sois", "seras", "étais"), 1),
        QuestionDemo(
            "B2",
            "Pourquoi l'entreprise a-t-elle modifié sa politique ?",
            ("Réduire les coûts", "Améliorer la flexibilité", "Recruter davantage", "S'installer à l'étranger"),
            1,
            "lecture",
            support="Après les retours des équipes, l'entreprise a introduit des horaires flexibles pour limiter "
            "l'effet des trajets sur la productivité.",
        ),
        _q(
            "C1",
            "Le rapport, ___ les conclusions ont fait polémique, a été retiré.",
            ("dont", "que", "duquel", "où"),
            0,
        ),
        _q("C1", "Bien qu'il ___ fatigué, il a continué.", ("est", "soit", "sera", "était"), 1),
        _q(
            "C1",
            "Cette mesure a eu un effet ___ sur les ventes.",
            ("considérable", "lourd", "haut", "épais"),
            0,
            "vocabulaire",
        ),
        _q("C2", "Quoi qu'il en ___, nous partirons demain.", ("est", "soit", "sera", "a été"), 1),
        _q("C2", "Je doute qu'il ___ pu venir.", ("a", "ait", "aura", "avait"), 1),
    ],
}


def charger_questions_demo(db: Session) -> int:
    """Ajoute les questions absentes (même langue, niveau et énoncé) et retourne le nombre de questions créées."""
    langues = {langue.code: langue for langue in db.scalars(select(Langue))}
    niveaux = {niveau.code: niveau for niveau in db.scalars(select(Niveau))}
    existantes = set(db.execute(select(Question.id_langue, Question.id_niveau, Question.enonce)).tuples())
    creees = 0
    for code_langue, questions in QUESTIONS_DEMO.items():
        langue = langues.get(code_langue)
        if langue is None:
            continue
        for demo in questions:
            niveau = niveaux[demo.niveau]
            if (langue.id_langue, niveau.id_niveau, demo.enonce) in existantes:
                continue
            db.add(
                Question(
                    enonce=demo.enonce,
                    competence=demo.competence,
                    type_reponse="choix",
                    choix=list(demo.choix),
                    reponse_correcte=demo.choix[demo.bonne_reponse],
                    support=demo.support,
                    audio_texte=demo.audio_texte,
                    langue=langue,
                    niveau=niveau,
                )
            )
            creees += 1
    db.commit()
    return creees
