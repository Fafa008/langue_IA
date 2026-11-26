"""Banque de démonstration du test de positionnement, chargée si SEED_DEMO=true."""

import json
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Langue, Niveau, Question, TypeExercice
from app.models.parcours import PACK_DIAGNOSTIC_COMPLET


@dataclass(frozen=True)
class QuestionDemo:
    niveau: str
    enonce: str
    competence: str
    format_exercice: str
    type_reponse: str
    bonne_reponse: str
    choix: tuple[str, ...] = ()
    support: str | None = None
    audio_texte: str | None = None
    lettres_melangees: tuple[str, ...] = ()
    duree_minimale_secondes: int | None = None


def _q(
    niveau: str,
    enonce: str,
    choix: tuple[str, ...],
    bonne: int,
    competence: str = "grammaire",
    support: str | None = None,
) -> QuestionDemo:
    return QuestionDemo(niveau, enonce, competence, "qcm", "choix", choix[bonne], choix=choix, support=support)


def _vrai_faux(niveau: str, enonce: str, vrai: bool, support: str) -> QuestionDemo:
    return QuestionDemo(
        niveau,
        enonce,
        "lecture",
        "vrai_faux",
        "choix",
        "Vrai" if vrai else "Faux",
        choix=("Vrai", "Faux"),
        support=support,
    )


def _ecoute(
    niveau: str,
    audio: str,
    enonce: str,
    choix: tuple[str, ...],
    bonne: int,
) -> QuestionDemo:
    return QuestionDemo(niveau, enonce, "ecoute", "qcm", "choix", choix[bonne], choix=choix, audio_texte=audio)


def _dictee(niveau: str, phrase: str, enonce: str = "Écrivez la phrase que vous avez entendue.") -> QuestionDemo:
    return QuestionDemo(niveau, enonce, "ecoute", "dictee", "texte", phrase, audio_texte=phrase)


def _trous(niveau: str, enonce: str, reponse: str, lettres: tuple[str, ...]) -> QuestionDemo:
    return QuestionDemo(
        niveau,
        enonce,
        "ecrit",
        "texte_a_trous",
        "texte",
        reponse,
        lettres_melangees=lettres,
    )


def _parler(niveau: str, phrase: str) -> QuestionDemo:
    return QuestionDemo(
        niveau,
        phrase,
        "oral",
        "parler",
        "texte",
        phrase,
        duree_minimale_secondes=2,
    )


QUESTIONS_DEMO: dict[str, list[QuestionDemo]] = {
    "en": [
        _q("A1", "She ___ a student.", ("is", "are", "am", "be"), 0),
        _q("A2", "We ___ to the cinema yesterday.", ("go", "goed", "went", "gone"), 2),
        _q("B1", 'Choose the opposite of "cheap".', ("expensive", "small", "easy", "early"), 0),
        _q(
            "B2",
            "By the time we arrived, the film ___.",
            ("already started", "had already started", "has already started", "was already start"),
            1,
        ),
        _vrai_faux(
            "C1",
            "The company changed its policy to reduce costs.",
            False,
            (
                "The company introduced flexible working hours after staff feedback "
                "showed that commuting affected productivity."
            ),
        ),
        _ecoute(
            "A1",
            "I live in London.",
            "Where does the speaker live?",
            ("London", "Berlin", "Rome", "Paris"),
            0,
        ),
        _dictee("A2", "I like reading books."),
        _ecoute(
            "B2",
            "For your train journey, I recommend booking your tickets in advance. Prices are usually lower.",
            "What does the speaker recommend?",
            ("Taking a later train", "Booking in advance", "Travelling by bus", "Working from home"),
            1,
        ),
        _dictee("C1", "She has lived here since 2015."),
        _ecoute(
            "C2",
            "Although remote work has improved flexibility, new employees may miss informal learning from colleagues.",
            "What drawback of remote work is mentioned?",
            ("Higher costs", "Less informal learning", "Longer hours", "Poor equipment"),
            1,
        ),
        _trous("A1", "My name ___ Maria.", "is", ("s", "i")),
        _trous("A2", "I have two ___ .", "books", ("s", "k", "o", "b", "o")),
        _trous("B1", "She has lived here ___ 2015.", "since", ("c", "e", "i", "n", "s")),
        _trous("B2", "If I had known, I ___ you earlier.", "would have called", ("would", "have", "called")),
        _trous(
            "C1",
            "The proposal was rejected, ___ it had strong support.",
            "although",
            ("although", "despite", "whereas"),
        ),
        _parler("A1", "My name is Maria."),
        _parler("A2", "I go to school by bus."),
        _parler("B1", "She has lived here since 2015."),
        _parler("B2", "I would have called you if I had known."),
        _parler("C2", "The proposal was rejected, notwithstanding its strong support."),
    ],
    "fr": [
        _q("A1", "Je ___ étudiant.", ("suis", "es", "est", "sommes"), 0),
        _q("A2", "Hier, elle ___ au cinéma.", ("va", "est allée", "irait", "allé"), 1),
        _q("B1", "Quel est le contraire de « cher » ?", ("bon marché", "petit", "facile", "tôt"), 0),
        _q("B2", "Quand nous sommes arrivés, le film ___ déjà commencé.", ("avait", "a", "était", "aura"), 0),
        _vrai_faux(
            "C1",
            "L'entreprise a changé sa politique pour réduire ses coûts.",
            False,
            (
                "Après les retours des équipes, l'entreprise a introduit des horaires flexibles "
                "pour limiter l'effet des trajets sur la productivité."
            ),
        ),
        _ecoute(
            "A1",
            "Bonjour, je m'appelle Luc.",
            "Comment s'appelle la personne ?",
            ("Luc", "Anna", "Paul", "Marie"),
            0,
        ),
        _dictee("A2", "J'habite à Paris."),
        _ecoute(
            "B2",
            (
                "Pour votre voyage en train, je vous conseille de réserver vos billets à l'avance. "
                "Les prix sont généralement plus bas."
            ),
            "Que conseille la personne ?",
            ("Prendre un train plus tard", "Réserver à l'avance", "Voyager en bus", "Travailler de chez soi"),
            1,
        ),
        _dictee("C1", "Elle habite ici depuis 2015."),
        _ecoute(
            "C2",
            (
                "Si le télétravail a amélioré la flexibilité, les nouveaux salariés perdent parfois "
                "l'apprentissage informel auprès de leurs collègues."
            ),
            "Quel inconvénient du télétravail est évoqué ?",
            (
                "Des coûts plus élevés",
                "Moins d'apprentissage informel",
                "Des journées plus longues",
                "Du matériel insuffisant",
            ),
            1,
        ),
        _trous("A1", "Je m'appelle ___ .", "Luc", ("c", "u", "l")),
        _trous("A2", "Il mange une ___ .", "pomme", ("e", "m", "m", "o", "p")),
        _trous("B1", "Elle habite ici ___ 2015.", "depuis", ("s", "i", "u", "p", "e", "d")),
        _trous("B2", "Si j'avais su, je t'___ plus tôt.", "aurais appelé", ("aurais", "appelé")),
        _trous(
            "C1", "Le rapport, ___ les conclusions ont fait polémique, a été retiré.", "dont", ("dont", "que", "où")
        ),
        _parler("A1", "Je m'appelle Luc."),
        _parler("A2", "J'habite à Paris."),
        _parler("B1", "Elle habite ici depuis 2015."),
        _parler("B2", "Je t'aurais appelé si j'avais su."),
        _parler("C2", "Le rapport a été retiré, bien que ses conclusions aient été débattues."),
    ],
    "de": [
        _q("A1", "Ich ___ Student.", ("bin", "bist", "ist", "sind"), 0),
        _q("A2", "Wir ___ gestern ins Kino.", ("gehen", "gingen", "gegangen", "geht"), 1),
        _q("B1", "Was ist das Gegenteil von « teuer »?", ("billig", "klein", "spät", "schnell"), 0),
        _q(
            "B2",
            "Als wir ankamen, ___ der Film schon ___.",
            ("hat / begonnen", "hatte / begonnen", "ist / beginnen", "war / beginnt"),
            1,
        ),
        _vrai_faux(
            "C1",
            "Das Unternehmen wollte seine Kosten senken.",
            False,
            "Das Unternehmen führte flexible Arbeitszeiten ein, weil die Anfahrt die Produktivität beeinträchtigte.",
        ),
        _ecoute("A1", "Ich heiße Maria.", "Wie heißt die Person?", ("Maria", "Anna", "Berlin", "Luc"), 0),
        _dictee("A2", "Ich wohne in Berlin."),
        _ecoute(
            "B2",
            "Ich empfehle, die Zugtickets im Voraus zu buchen. Dann sind die Preise oft günstiger.",
            "Was empfiehlt die Person?",
            ("Später fahren", "Im Voraus buchen", "Mit dem Bus fahren", "Zu Hause arbeiten"),
            1,
        ),
        _dictee(
            "C1", "Obwohl Homeoffice die Flexibilität verbessert, fehlt neuen Mitarbeitern oft das informelle Lernen."
        ),
        _ecoute(
            "C2",
            (
                "Die neue Regelung wurde trotz erheblicher Kritik umgesetzt, weil sie langfristig "
                "die Zusammenarbeit verbessern sollte."
            ),
            "Warum wurde die Regelung umgesetzt?",
            (
                "Sie sollte die Zusammenarbeit verbessern",
                "Sie senkte sofort die Kosten",
                "Sie wurde nicht kritisiert",
                "Sie galt nur kurzfristig",
            ),
            0,
        ),
        _trous("A1", "Ich heiße ___ .", "Maria", ("a", "i", "r", "m", "a")),
        _trous("A2", "Ich wohne in ___ .", "Berlin", ("l", "i", "n", "b", "e", "r")),
        _trous("B1", "Ich habe hier ___ 2015 gewohnt.", "seit", ("t", "i", "e", "s")),
        _trous("B2", "Wenn ich es gewusst hätte, ___ ich früher gekommen.", "wäre", ("w", "ä", "r", "e")),
        _trous(
            "C1", "Der Vorschlag wurde abgelehnt, ___ er breite Unterstützung hatte.", "obwohl", ("obwohl", "trotz")
        ),
        _parler("A1", "Ich heiße Maria."),
        _parler("A2", "Ich wohne in Berlin."),
        _parler("B1", "Ich habe hier seit 2015 gewohnt."),
        _parler("B2", "Wenn ich es gewusst hätte, wäre ich früher gekommen."),
        _parler("C2", "Der Vorschlag wurde trotz seiner breiten Unterstützung abgelehnt."),
    ],
    "it": [
        _q("A1", "Io ___ studente.", ("sono", "sei", "è", "siamo"), 0),
        _q("A2", "Noi ___ al cinema ieri.", ("andiamo", "andammo", "andremo", "vada"), 1),
        _q("B1", "Qual è il contrario di « caro »?", ("economico", "piccolo", "facile", "presto"), 0),
        _q(
            "B2",
            "Quando siamo arrivati, il film ___ già ___.",
            ("era / iniziato", "ha / iniziato", "è / iniziare", "aveva / inizia"),
            0,
        ),
        _vrai_faux(
            "C1",
            "L'azienda voleva ridurre i costi.",
            False,
            "L'azienda ha introdotto orari flessibili dopo che i dipendenti hanno segnalato il problema dei tragitti.",
        ),
        _ecoute("A1", "Mi chiamo Marco.", "Come si chiama la persona?", ("Marco", "Anna", "Roma", "Lucia"), 0),
        _dictee("A2", "Abito a Roma."),
        _ecoute(
            "B2",
            "Per il viaggio in treno, consiglio di prenotare i biglietti in anticipo: spesso costano meno.",
            "Cosa consiglia la persona?",
            ("Partire più tardi", "Prenotare in anticipo", "Viaggiare in autobus", "Lavorare da casa"),
            1,
        ),
        _dictee("C1", "Vivo qui dal 2015."),
        _ecoute(
            "C2",
            (
                "La proposta è stata approvata nonostante le critiche, perché avrebbe migliorato "
                "la collaborazione nel lungo periodo."
            ),
            "Perché è stata approvata la proposta?",
            (
                "Avrebbe migliorato la collaborazione",
                "Avrebbe ridotto subito i costi",
                "Non era stata criticata",
                "Era una misura temporanea",
            ),
            0,
        ),
        _trous("A1", "Mi chiamo ___ .", "Marco", ("o", "c", "r", "a", "m")),
        _trous("A2", "Abito a ___ .", "Roma", ("a", "m", "o", "r")),
        _trous("B1", "Vivo qui ___ 2015.", "dal", ("l", "a", "d")),
        _trous("B2", "Se l'avessi saputo, ti ___ prima.", "avrei chiamato", ("avrei", "chiamato")),
        _trous(
            "C1", "La proposta, ___ il sostegno era ampio, è stata respinta.", "nonostante", ("nonostante", "sebbene")
        ),
        _parler("A1", "Mi chiamo Marco."),
        _parler("A2", "Abito a Roma."),
        _parler("B1", "Vivo qui dal 2015."),
        _parler("B2", "Ti avrei chiamato prima se l'avessi saputo."),
        _parler("C2", "La proposta è stata respinta nonostante il sostegno fosse ampio."),
    ],
    "zh": [
        _q("HSK 1", "我 ___ 学生。", ("是", "在", "有", "和"), 0),
        _q("HSK 2", "昨天我 ___ 了电影。", ("看", "看了", "看着", "看见"), 1),
        _q("HSK 3", "“谢谢”是什么意思？", ("Merci", "Bonjour", "Au revoir", "Excusez-moi"), 0),
        _q("HSK 4", "如果我早点知道，我 ___ 告诉你。", ("会", "就会", "已经", "正在"), 1),
        _vrai_faux(
            "HSK 5",
            "公司改变政策是为了降低成本。",
            False,
            "公司实行了弹性工作时间，因为通勤影响了工作效率。",
        ),
        _ecoute("HSK 1", "我叫小明。", "Comment s'appelle la personne ?", ("小明", "北京", "学生", "咖啡"), 0),
        _dictee("HSK 2", "我住在北京。", "请写下你听到的句子。"),
        _ecoute(
            "HSK 4",
            "我建议你提前订票，这样通常更便宜。",
            "Que conseille la personne ?",
            ("Réserver à l'avance", "Prendre un bus", "Rester chez soi", "Annuler le voyage"),
            0,
        ),
        _dictee("HSK 5", "虽然远程工作更灵活，但是新员工可能会错过与同事的非正式学习。", "请写下你听到的句子。"),
        _ecoute(
            "HSK 6",
            "尽管这个方案受到批评，团队还是决定采用它，因为它有助于长期合作。",
            "为什么团队采用这个方案？",
            ("有助于长期合作", "可以立即降低成本", "没有人批评它", "只需要短期使用"),
            0,
        ),
        _trous("HSK 1", "请补全句子：我 ___ 学生。", "是", ("是",)),
        _trous("HSK 2", "我住在 ___ 。", "北京", ("京", "北")),
        _trous("HSK 3", "我每天 ___ 中文。", "学习", ("习", "学")),
        _trous("HSK 4", "请补全句子：如果我早点知道，我 ___ 告诉你。", "就会", ("就", "会")),
        _trous("HSK 5", "尽管下雨，比赛 ___ 继续进行。", "仍然", ("然", "仍")),
        _parler("HSK 1", "你好。"),
        _parler("HSK 2", "我住在北京。"),
        _parler("HSK 3", "我每天学习中文。"),
        _parler("HSK 4", "如果我早点知道，我就会告诉你。"),
        _parler("HSK 6", "尽管这个方案受到批评，团队还是决定采用它。"),
    ],
}


_TYPES_EXERCICE = {
    "grammaire": TypeExercice.GRAMMAIRE,
    "lecture": TypeExercice.COMPREHENSION,
    "ecoute": TypeExercice.ECOUTE,
    "ecrit": TypeExercice.COMPREHENSION,
    "oral": TypeExercice.ORAL,
}
_DIFFICULTES = {
    "A1": 1,
    "A2": 2,
    "B1": 3,
    "B2": 4,
    "C1": 5,
    "C2": 5,
    "HSK 1": 1,
    "HSK 2": 2,
    "HSK 3": 3,
    "HSK 4": 4,
    "HSK 5": 5,
    "HSK 6": 5,
}


def _contenu_question(question: QuestionDemo) -> str:
    contenu = {
        "diagnostic_pack": PACK_DIAGNOSTIC_COMPLET,
        "enonce": question.enonce,
        "competence": question.competence,
        "format": question.type_reponse,
        "format_exercice": question.format_exercice,
        "reponses": [question.bonne_reponse],
    }
    if question.choix:
        contenu["choix"] = list(question.choix)
    if question.support:
        contenu["support"] = question.support
    if question.audio_texte:
        contenu["texte_audio"] = question.audio_texte
    if question.lettres_melangees:
        contenu["lettres_melangees"] = list(question.lettres_melangees)
    if question.duree_minimale_secondes:
        contenu["duree_minimale_secondes"] = question.duree_minimale_secondes
    return json.dumps(contenu, ensure_ascii=False)


def charger_questions_demo(db: Session) -> int:
    """Ajoute les questions absentes du pack et retourne le nombre d'exercices créés."""
    langues = {langue.code: langue for langue in db.scalars(select(Langue))}
    niveaux = {niveau.code: niveau for niveau in db.scalars(select(Niveau))}
    existantes = {
        (exercice.id_langue, exercice.id_niveau, exercice.enonce, exercice.diagnostic_pack)
        for exercice in db.scalars(select(Question).where(Question.usage.in_(("diagnostic", "les deux")))).all()
    }
    creees = 0
    for code_langue, questions in QUESTIONS_DEMO.items():
        langue = langues.get(code_langue)
        if langue is None:
            continue
        for demo in questions:
            niveau = niveaux[demo.niveau]
            cle = (langue.id_langue, niveau.id_niveau, demo.enonce, PACK_DIAGNOSTIC_COMPLET)
            if cle in existantes:
                continue
            db.add(
                Question(
                    type=_TYPES_EXERCICE[demo.competence],
                    contenu=_contenu_question(demo),
                    difficulte=_DIFFICULTES[demo.niveau],
                    usage="diagnostic",
                    statut="publié",
                    origine="systeme:seed_diagnostic",
                    auteur="systeme:seed_diagnostic",
                    donnees_test=True,
                    langue=langue,
                    niveau=niveau,
                )
            )
            existantes.add(cle)
            creees += 1
    db.commit()
    return creees
