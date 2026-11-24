/**
 * Libellés de l'interface du tuteur IA, dans la langue du parcours de l'apprenant.
 *
 * Le français reste la valeur par défaut : les exercices de parcours en français et les anciens
 * scénarios de test conservent leurs libellés historiques. Le contenu pédagogique (réponses du
 * tuteur, traductions) ne passe pas par ici : il vient du backend.
 */
export interface LibellesChat {
  espaceApprenant: string;
  titre: string;
  conversation: string;
  journal: string;
  scenario: string;
  contexte: string;
  langueParcours: string;
  avertissement: string;
  chargement: string;
  faireTest: string;
  consigne: string;
  sujet: string;
  echanges: string;
  simule: string;
  quota: string;
  quotaEpuise: string;
  votreMessage: string;
  placeholder: string;
  placeholderEcoute: string;
  envoyer: string;
  dicter: string;
  dictéeIndisponible: string;
  tuteurEcrit: string;
  correctionTraductionEnCours: string;
  secondairesIndisponibles: string;
  correctionsMarge: string;
  traductionFr: string;
  explication: string;
  exerciceCible: string;
  exerciceEnCours: string;
  genererExercice: string;
  descripteur: string;
  exerciceIndisponible: string;
  evaluationEnCours: string;
  terminerRapport: string;
  terminerDefaut: string;
  ecouter: string;
  erreurTuteur: string;
}

const FR: LibellesChat = {
  espaceApprenant: "Espace apprenant",
  titre: "Tuteur IA",
  conversation: "Conversation",
  journal: "Conversation avec le tuteur IA",
  scenario: "Scénario",
  contexte: "Contexte :",
  langueParcours: "langue de votre parcours",
  avertissement:
    "Avant votre premier message : vos échanges et les 20 derniers tours sont transmis au service IA pour produire une réponse. N’y saisissez aucune donnée personnelle (adresse e-mail, numéro de téléphone, etc.). L’historique est supprimé à la fin de la conversation ; le journal ne conserve aucun texte brut.",
  chargement: "Chargement de votre parcours…",
  faireTest: "Faire le test de positionnement",
  consigne: "Discutez avec le tuteur IA, à l'écrit ou à la voix.",
  sujet: "Sujet :",
  echanges: "échanges",
  simule: "tuteur IA simulé (démonstration)",
  quota: "Messages restants dans cette session :",
  quotaEpuise: "— terminez et recommencez une conversation.",
  votreMessage: "Votre message",
  placeholder: "Écrivez ou dictez votre réponse…",
  placeholderEcoute: "Je vous écoute…",
  envoyer: "Envoyer",
  dicter: "Dicter",
  dictéeIndisponible: "Dictée indisponible dans ce navigateur : le mode écrit de secours reste actif.",
  tuteurEcrit: "Le tuteur IA écrit…",
  correctionTraductionEnCours: "Correction et traduction en cours…",
  secondairesIndisponibles: "La correction et la traduction n'ont pas pu être chargées ; la réponse du tuteur reste disponible.",
  correctionsMarge: "Corrections en marge",
  traductionFr: "Traduction en français",
  explication: "Explication",
  exerciceCible: "Exercice ciblé",
  exerciceEnCours: "Exercice en cours…",
  genererExercice: "Générer un exercice ciblé",
  descripteur: "Descripteur :",
  exerciceIndisponible: "L'exercice ciblé est momentanément indisponible.",
  evaluationEnCours: "Évaluation en cours…",
  terminerRapport: "Terminer et voir le rapport",
  terminerDefaut: "Terminer et évaluer la conversation",
  ecouter: "Écouter ce message",
  erreurTuteur: "La réponse du tuteur IA",
};

const EN: LibellesChat = {
  espaceApprenant: "Learner area",
  titre: "AI tutor",
  conversation: "Conversation",
  journal: "Conversation with the AI tutor",
  scenario: "Scenario",
  contexte: "Context:",
  langueParcours: "your course language",
  avertissement:
    "Before your first message: your exchanges and the last 20 turns are sent to the AI service to produce a reply. Do not enter personal details (email address, phone number, etc.). The history is deleted at the end of the conversation; logs keep no raw text.",
  chargement: "Loading your course…",
  faireTest: "Take the placement test",
  consigne: "Talk with the AI tutor, in writing or by voice.",
  sujet: "Topic:",
  echanges: "exchanges",
  simule: "simulated AI tutor (demo)",
  quota: "Messages left in this session:",
  quotaEpuise: "— finish and start a new conversation.",
  votreMessage: "Your message",
  placeholder: "Write or dictate your reply…",
  placeholderEcoute: "I'm listening…",
  envoyer: "Send",
  dicter: "Dictate",
  dictéeIndisponible: "Dictation is unavailable in this browser: you can still type your reply.",
  tuteurEcrit: "The AI tutor is writing…",
  correctionTraductionEnCours: "Correction and translation in progress…",
  secondairesIndisponibles: "Correction and translation could not be loaded; the tutor's reply is still available.",
  correctionsMarge: "Corrections in the margin",
  traductionFr: "French translation",
  explication: "Explanation",
  exerciceCible: "Targeted exercise",
  exerciceEnCours: "Exercise in progress…",
  genererExercice: "Generate a targeted exercise",
  descripteur: "Descriptor:",
  exerciceIndisponible: "The targeted exercise is temporarily unavailable.",
  evaluationEnCours: "Evaluation in progress…",
  terminerRapport: "Finish and view the report",
  terminerDefaut: "Finish and evaluate the conversation",
  ecouter: "Listen to this message",
  erreurTuteur: "The AI tutor's reply",
};

const IT: LibellesChat = {
  espaceApprenant: "Area apprendente",
  titre: "Tutore IA",
  conversation: "Conversazione",
  journal: "Conversazione con il tutore IA",
  scenario: "Scenario",
  contexte: "Contesto:",
  langueParcours: "lingua del tuo percorso",
  avertissement:
    "Prima del primo messaggio: i tuoi scambi e gli ultimi 20 turni sono inviati al servizio IA per produrre una risposta. Non inserire dati personali (e-mail, numero di telefono, ecc.). La cronologia viene eliminata a fine conversazione; i log non conservano testi grezzi.",
  chargement: "Caricamento del percorso…",
  faireTest: "Svolgi il test di posizionamento",
  consigne: "Parla con il tutore IA, per scritto o a voce.",
  sujet: "Argomento:",
  echanges: "scambi",
  simule: "tutore IA simulato (demo)",
  quota: "Messaggi rimasti in questa sessione:",
  quotaEpuise: "— termina e inizia una nuova conversazione.",
  votreMessage: "Il tuo messaggio",
  placeholder: "Scrivi o detta la tua risposta…",
  placeholderEcoute: "Ti ascolto…",
  envoyer: "Invia",
  dicter: "Detta",
  dictéeIndisponible: "Dettato non disponibile in questo browser: puoi comunque scrivere.",
  tuteurEcrit: "Il tutore IA sta scrivendo…",
  correctionTraductionEnCours: "Correzione e traduzione in corso…",
  secondairesIndisponibles: "Correzione e traduzione non disponibili; la risposta del tutore resta visibile.",
  correctionsMarge: "Correzioni a margine",
  traductionFr: "Traduzione in francese",
  explication: "Spiegazione",
  exerciceCible: "Esercizio mirato",
  exerciceEnCours: "Esercizio in corso…",
  genererExercice: "Genera un esercizio mirato",
  descripteur: "Descrittore:",
  exerciceIndisponible: "L'esercizio mirato è temporaneamente non disponibile.",
  evaluationEnCours: "Valutazione in corso…",
  terminerRapport: "Termina e visualizza il rapporto",
  terminerDefaut: "Termina e valuta la conversazione",
  ecouter: "Ascolta questo messaggio",
  erreurTuteur: "La risposta del tutore IA",
};

const DE: LibellesChat = {
  espaceApprenant: "Lernbereich",
  titre: "KI-Tutor",
  conversation: "Gespräch",
  journal: "Gespräch mit dem KI-Tutor",
  scenario: "Szenario",
  contexte: "Kontext:",
  langueParcours: "Sprache deines Kurses",
  avertissement:
    "Vor deiner ersten Nachricht: Deine Unterhaltungen und die letzten 20 Runden werden an den KI-Dienst gesendet, um eine Antwort zu erzeugen. Gib keine persönlichen Daten ein (E-Mail-Adresse, Telefonnummer usw.). Der Verlauf wird am Ende des Gesprächs gelöscht; Protokolle enthalten keinen Rohtext.",
  chargement: "Kurs wird geladen…",
  faireTest: "Einstufungstest ablegen",
  consigne: "Sprich mit dem KI-Tutor, schriftlich oder mündlich.",
  sujet: "Thema:",
  echanges: "Runden",
  simule: "simulierter KI-Tutor (Demo)",
  quota: "Nachrichten in dieser Sitzung:",
  quotaEpuise: "— beende das Gespräch und starte ein neues.",
  votreMessage: "Deine Nachricht",
  placeholder: "Antwort schreiben oder diktieren…",
  placeholderEcoute: "Ich höre zu…",
  envoyer: "Senden",
  dicter: "Diktieren",
  dictéeIndisponible: "Diktat in diesem Browser nicht verfügbar: Tippen bleibt möglich.",
  tuteurEcrit: "Der KI-Tutor schreibt…",
  correctionTraductionEnCours: "Korrektur und Übersetzung laufen…",
  secondairesIndisponibles: "Korrektur und Übersetzung nicht verfügbar; die Antwort des Tutors bleibt sichtbar.",
  correctionsMarge: "Korrekturen am Rand",
  traductionFr: "Französische Übersetzung",
  explication: "Erklärung",
  exerciceCible: "Gezielte Übung",
  exerciceEnCours: "Übung läuft…",
  genererExercice: "Gezielte Übung erzeugen",
  descripteur: "Deskriptor:",
  exerciceIndisponible: "Die gezielte Übung ist vorübergehend nicht verfügbar.",
  evaluationEnCours: "Auswertung läuft…",
  terminerRapport: "Beenden und Bericht ansehen",
  terminerDefaut: "Beenden und Gespräch auswerten",
  ecouter: "Diese Nachricht anhören",
  erreurTuteur: "Die Antwort des KI-Tutors",
};

const ZH: LibellesChat = {
  espaceApprenant: "学习区",
  titre: "AI 导师",
  conversation: "对话",
  journal: "与 AI 导师的对话",
  scenario: "场景",
  contexte: "场景：",
  langueParcours: "课程语言",
  avertissement:
    "发送第一条消息前：你的对话及最近 20 轮内容会发送给 AI 服务以生成回复。请勿输入个人信息（电子邮箱、电话号码等）。对话结束后历史记录将被删除；日志不保存原文。",
  chargement: "正在加载课程…",
  faireTest: "参加水平测试",
  consigne: "与 AI 导师交流，可以打字或语音。",
  sujet: "主题：",
  echanges: "轮交流",
  simule: "模拟 AI 导师（演示）",
  quota: "本次会话剩余消息：",
  quotaEpuise: "— 请结束并开始新对话。",
  votreMessage: "你的消息",
  placeholder: "输入或口述你的回复…",
  placeholderEcoute: "正在聆听…",
  envoyer: "发送",
  dicter: "口述",
  dictéeIndisponible: "此浏览器不支持语音输入：仍可打字回复。",
  tuteurEcrit: "AI 导师正在输入…",
  correctionTraductionEnCours: "正在批改和翻译…",
  secondairesIndisponibles: "批改和翻译暂不可用；导师的回复仍然可见。",
  correctionsMarge: "批改建议",
  traductionFr: "法语翻译",
  explication: "解释",
  exerciceCible: "针对性练习",
  exerciceEnCours: "练习生成中…",
  genererExercice: "生成针对性练习",
  descripteur: "能力描述：",
  exerciceIndisponible: "针对性练习暂时不可用。",
  evaluationEnCours: "评估中…",
  terminerRapport: "结束并查看报告",
  terminerDefaut: "结束并评估对话",
  ecouter: "朗读此消息",
  erreurTuteur: "AI 导师的回复",
};

const LIBELLES: Record<string, LibellesChat> = { fr: FR, en: EN, it: IT, de: DE, zh: ZH };

/** Libellés dans la langue demandée, avec repli sur le français pour une langue non traduite. */
export const libellesChat = (langue: string): LibellesChat => LIBELLES[langue] ?? FR;
