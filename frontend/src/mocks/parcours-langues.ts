/*
 * Contenus du parcours simulé, par langue d'apprentissage.
 * Le preset « demo » choisit le paquet d'après le parcours réel de l'apprenant (code_langue du backend).
 * Le paquet « fr » reste le défaut : c'est celui des tests unitaires et du parcours de seed.
 */
export type CodeLangueParcoursMock = "fr" | "en" | "zh" | "it" | "de";

interface ModuleMock {
  titre: string;
  description: string;
}

interface ChoixMock {
  type: "GRAMMAIRE" | "COMPREHENSION";
  intitule: string;
  consigne: string;
  enonce: string;
  choix: string[];
  reponse: string;
  explication: string;
}

interface TexteMock {
  intitule: string;
  consigne: string;
  enonce: string;
  reponses: string[];
  explication: string;
}

interface EcouteMock {
  intitule: string;
  texte: string;
  question: string;
  choix: string[];
  reponse: string;
  explication: string;
}

interface PrononciationMock {
  intitule: string;
  phrase: string;
}

interface ConversationMock {
  intitule: string;
  sujet: string;
  message_initial: string;
  relances: string[];
}

interface RedactionMock {
  intitule: string;
  enonce: string;
}

interface ActionRecommandationMock {
  domaine: string;
  type_exercice: string;
  action: string;
  justification: string;
}

interface MessagesMock {
  consigneChoix: string;
  consigneEcoute: string;
  consignePrononciation: string;
  consigneRedaction: string;
  consigneConversation: string;
  conversationOk: string;
  conversationKo: string;
  pointFortConversation: string;
  conseilConversation: string;
  prononciationBon: string;
  prononciationMoyen: string;
  prononciationFaible: string;
  bonneReponse: string;
  mauvaiseReponse: string;
  texteBon: string;
  texteMoyen: string;
  texteFaible: string;
  majusculeExplication: string;
  pointExplication: string;
  pointFinal: string;
  texteDeveloppe: (nombre: number) => string;
  texteManque: (minimum: number, manque: number) => string;
  conseilRelire: string;
  conseilComparer: string;
  conseilOpinion: string;
  traductionPrefix: (reponse: string) => string;
  traductionExplication: string;
  reponseCourte: string;
  reactions: string[];
  relanceFin: string;
  exerciceCibleEnonce: (erreur: string) => string;
  exerciceCibleConsigne: (typeErreur: string) => string;
  descripteurId: string;
}

export interface PackParcoursMock {
  code: CodeLangueParcoursMock;
  libelle: string;
  cadre: "CECRL" | "HSK";
  niveaux: string[];
  modules: ModuleMock[];
  choix: ChoixMock[];
  textes: TexteMock[];
  ecoutes: EcouteMock[];
  prononciations: PrononciationMock[];
  conversations: ConversationMock[];
  redactions: RedactionMock[];
  recommandations: ActionRecommandationMock[];
  resumeRecommandation: string;
  messages: MessagesMock;
}

const FR: PackParcoursMock = {
  code: "fr",
  libelle: "Français",
  cadre: "CECRL",
  niveaux: ["A1", "A2", "B1", "B2", "C1", "C2"],
  modules: [
    { titre: "Premiers contacts", description: "Saluer, se présenter, épeler son nom." },
    { titre: "Vie quotidienne", description: "Parler de sa journée, de sa famille et de son logement." },
    { titre: "Se déplacer et s'orienter", description: "Demander son chemin, prendre les transports." },
    { titre: "Loisirs et goûts", description: "Exprimer ses goûts, proposer une sortie." },
    { titre: "Travail et études", description: "Parler de son métier, de sa formation et de ses projets." },
    { titre: "Santé et bien-être", description: "Décrire un symptôme, prendre rendez-vous." },
    { titre: "Société et actualité", description: "Comprendre une information et réagir." },
    { titre: "S'exprimer et argumenter", description: "Donner son opinion, nuancer, convaincre." },
  ],
  choix: [
    { type: "GRAMMAIRE", intitule: "Le passé composé", consigne: "Choisissez la bonne forme.", enonce: "Hier, je ___ au cinéma.", choix: ["vais", "suis allé", "irai"], reponse: "suis allé", explication: "« Hier » situe l'action dans le passé : on emploie le passé composé, avec l'auxiliaire être pour « aller »." },
    { type: "GRAMMAIRE", intitule: "Le futur proche", consigne: "Choisissez la bonne forme.", enonce: "Ce soir, nous ___ dîner chez des amis.", choix: ["allons", "sommes allés", "allions"], reponse: "allons", explication: "« Ce soir » annonce un futur proche : aller au présent + infinitif (« nous allons dîner »)." },
    { type: "COMPREHENSION", intitule: "Lire une annonce", consigne: "« Le musée est ouvert du mardi au dimanche, de 10 h à 18 h. »", enonce: "Peut-on visiter le musée le lundi ?", choix: ["Oui", "Non", "Seulement le matin"], reponse: "Non", explication: "Le musée ouvre du mardi au dimanche : il est donc fermé le lundi." },
    { type: "COMPREHENSION", intitule: "Comprendre un message", consigne: "« Rendez-vous devant la gare à 9 h, ne sois pas en retard ! »", enonce: "Où est le rendez-vous ?", choix: ["À la gare", "Au café", "À l'école"], reponse: "À la gare", explication: "Le message dit « devant la gare »." },
  ],
  textes: [
    { intitule: "Les salutations", consigne: "Complétez la phrase.", enonce: "___, je m'appelle Marie.", reponses: ["Bonjour", "Bonsoir", "Salut"], explication: "On ouvre une présentation par une salutation : « Bonjour », « Bonsoir » ou « Salut »." },
    { intitule: "Prendre rendez-vous", consigne: "Complétez avec le bon verbe.", enonce: "Je voudrais ___ un rendez-vous chez le médecin.", reponses: ["prendre"], explication: "On dit « prendre un rendez-vous »." },
    { intitule: "Demander poliment", consigne: "Complétez avec « pouvoir » au conditionnel.", enonce: "___-vous m'indiquer la gare, s'il vous plaît ?", reponses: ["Pourriez"], explication: "« Pouvoir » au conditionnel avec « vous » : « pourriez ». Le conditionnel rend la demande polie." },
    { intitule: "Au restaurant", consigne: "Complétez la commande.", enonce: "Je ___ un café, s'il vous plaît.", reponses: ["voudrais", "veux", "prends"], explication: "« Je voudrais » (conditionnel) est la forme la plus polie pour commander." },
  ],
  ecoutes: [
    { intitule: "Un message vocal", texte: "Bonjour, c'est Paul. Je serai en retard de dix minutes. À tout à l'heure !", question: "Que dit Paul ?", choix: ["Il annule le rendez-vous", "Il sera en retard", "Il est déjà arrivé"], reponse: "Il sera en retard", explication: "Paul dit : « Je serai en retard de dix minutes »." },
    { intitule: "À la gare", texte: "Le train pour Lyon partira du quai numéro trois à quatorze heures.", question: "De quel quai part le train ?", choix: ["Quai 1", "Quai 3", "Quai 14"], reponse: "Quai 3", explication: "L'annonce dit « quai numéro trois » ; quatorze heures est l'horaire." },
    { intitule: "La météo", texte: "Demain, il pleuvra le matin, puis le soleil reviendra l'après-midi.", question: "Quel temps fera-t-il demain après-midi ?", choix: ["Pluie", "Soleil", "Neige"], reponse: "Soleil", explication: "« Le soleil reviendra l'après-midi » ; la pluie, c'est le matin." },
  ],
  prononciations: [
    { intitule: "Se présenter", phrase: "Bonjour, je m'appelle Marie et j'habite à Paris." },
    { intitule: "Commander", phrase: "Je voudrais un café et un croissant, s'il vous plaît." },
    { intitule: "Demander son chemin", phrase: "Excusez-moi, où se trouve la gare ?" },
  ],
  conversations: [
    { intitule: "Faire connaissance", sujet: "Se présenter", message_initial: "Bonjour ! Je suis votre tuteur IA. Comment vous appelez-vous ?", relances: ["Enchanté ! D'où venez-vous ?", "Et que faites-vous dans la vie ?", "Qu'aimez-vous faire le week-end ?"] },
    { intitule: "Au restaurant", sujet: "Commander un repas", message_initial: "Bonsoir et bienvenue ! Vous avez choisi votre plat ?", relances: ["Très bon choix. Et comme boisson ?", "Vous prendrez un dessert ?", "Parfait. Vous payez par carte ou en espèces ?"] },
    { intitule: "Organiser une sortie", sujet: "Proposer une activité", message_initial: "Salut ! On sort ce week-end ? Qu'est-ce que tu proposes ?", relances: ["Bonne idée ! Quel jour te convient ?", "À quelle heure on se retrouve ?", "Où est-ce qu'on se donne rendez-vous ?"] },
  ],
  redactions: [
    { intitule: "Raconter son week-end", enonce: "Racontez votre dernier week-end en quelques phrases : où étiez-vous, avec qui, qu'avez-vous fait ?" },
    { intitule: "Écrire à un ami", enonce: "Écrivez un court message à un ami pour lui proposer une sortie samedi." },
    { intitule: "Décrire sa ville", enonce: "Décrivez votre ville ou votre quartier : ce que vous aimez et ce que vous aimez moins." },
  ],
  recommandations: [
    { domaine: "grammaire", type_exercice: "GRAMMAIRE", action: "Refaire un exercice sur le passé composé des verbes irréguliers.", justification: "Les formes au passé composé sont encore hésitantes dans vos réponses." },
    { domaine: "vocabulaire", type_exercice: "VOCABULAIRE", action: "Réviser le vocabulaire des déplacements et des directions.", justification: "Quelques mots du champ lexical du trajet manquent." },
  ],
  resumeRecommandation: "Deux actions courtes : conjugaison puis vocabulaire des déplacements.",
  messages: {
    consigneChoix: "Choisissez la bonne forme.",
    consigneEcoute: "Écoutez l'extrait, puis répondez.",
    consignePrononciation: "Lisez la phrase à voix haute.",
    consigneRedaction: "Rédigez votre réponse ; le professeur IA la corrigera.",
    consigneConversation: "Discutez avec le tuteur IA, à l'écrit ou à la voix.",
    conversationOk: "Belle conversation ! Vos réponses étaient claires et adaptées.",
    conversationKo: "Continuez l'échange : répondez à au moins trois questions du professeur.",
    pointFortConversation: "Vous avez répondu dans la langue étudiée.",
    conseilConversation: "Essayez de poser vous aussi une question au professeur.",
    prononciationBon: "Très bonne prononciation !",
    prononciationMoyen: "Bien ! Quelques mots ne sont pas reconnus.",
    prononciationFaible: "Réessayez en articulant chaque mot.",
    bonneReponse: "Bonne réponse !",
    mauvaiseReponse: "Ce n'est pas la bonne réponse.",
    texteBon: "Très bon texte, clair et bien construit.",
    texteMoyen: "Bon travail ! Quelques points sont à corriger.",
    texteFaible: "Votre texte doit être complété et corrigé.",
    majusculeExplication: "Une phrase commence par une majuscule.",
    pointExplication: "Terminez chaque phrase par un point.",
    pointFinal: ".",
    texteDeveloppe: (nombre) => `Texte assez développé (${nombre} mots).`,
    texteManque: (minimum, manque) => `Développez davantage : écrivez au moins ${minimum} mots (il en manque ${manque}).`,
    conseilRelire: "Relisez la leçon du jour à voix haute : ces formes deviendront naturelles.",
    conseilComparer: "Comparez votre texte à la version corrigée, puis réécrivez-le sans la regarder.",
    conseilOpinion: "Essayez maintenant d'ajouter une opinion personnelle (« À mon avis… »).",
    traductionPrefix: (reponse) => `Traduction française (démonstration) : « ${reponse} ».`,
    traductionExplication: "Explication (démonstration) : reformulez cette phrase avec vos propres mots ; un modèle de langue fournit une traduction et une explication détaillées.",
    reponseCourte: "Pouvez-vous répondre avec une phrase complète ? Par exemple : « Je m'appelle… ».",
    reactions: ["Très bien !", "D'accord, merci.", "Intéressant !"],
    relanceFin: "Merci pour cet échange, vous pouvez terminer la conversation.",
    exerciceCibleEnonce: (erreur) => `Réécrivez « ${erreur} » au passé.`,
    exerciceCibleConsigne: (typeErreur) => `Exercice de démonstration ciblé sur ${typeErreur}.`,
    descripteurId: "cecrl-a1-grammaire-1",
  },
};

const EN: PackParcoursMock = {
  code: "en",
  libelle: "Anglais",
  cadre: "CECRL",
  niveaux: ["A1", "A2", "B1", "B2", "C1", "C2"],
  modules: [
    { titre: "First contacts", description: "Greet people, introduce yourself, spell your name." },
    { titre: "Everyday life", description: "Talk about your day, your family and your home." },
    { titre: "Getting around", description: "Ask for directions and use public transport." },
    { titre: "Leisure and interests", description: "Express preferences and suggest an outing." },
    { titre: "Work and studies", description: "Talk about your job, training and plans." },
    { titre: "Health and well-being", description: "Describe a symptom and make an appointment." },
    { titre: "Society and news", description: "Understand a short news item and react to it." },
    { titre: "Expressing opinions", description: "Give an opinion, qualify it and persuade." },
  ],
  choix: [
    { type: "GRAMMAIRE", intitule: "The simple past", consigne: "Choose the correct form.", enonce: "Yesterday, I ___ to the cinema.", choix: ["go", "went", "have gone"], reponse: "went", explication: "“Yesterday” refers to a finished time, so the simple past is needed." },
    { type: "GRAMMAIRE", intitule: "The future with going to", consigne: "Choose the correct form.", enonce: "Tonight, we ___ dinner at a friend's house.", choix: ["are going to have", "had", "were having"], reponse: "are going to have", explication: "“Tonight” refers to a plan: be going to + verb." },
    { type: "COMPREHENSION", intitule: "Reading a notice", consigne: "“The museum is open from Tuesday to Sunday, 10 a.m. to 6 p.m.”", enonce: "Can you visit the museum on Monday?", choix: ["Yes", "No", "Only in the morning"], reponse: "No", explication: "The museum opens from Tuesday to Sunday, so it is closed on Monday." },
    { type: "COMPREHENSION", intitule: "Understanding a message", consigne: "“Meet me in front of the station at 9, don't be late!”", enonce: "Where is the meeting?", choix: ["At the station", "At the café", "At school"], reponse: "At the station", explication: "The message says “in front of the station”." },
  ],
  textes: [
    { intitule: "Greetings", consigne: "Complete the sentence.", enonce: "___, my name is Marie.", reponses: ["Hello", "Good evening", "Hi"], explication: "A presentation usually starts with a greeting: “Hello”, “Good evening” or “Hi”." },
    { intitule: "Making an appointment", consigne: "Complete with the right verb.", enonce: "I'd like to ___ an appointment with the doctor.", reponses: ["make"], explication: "In English we say “make an appointment”." },
    { intitule: "Polite requests", consigne: "Complete with the conditional.", enonce: "___ you tell me where the station is, please?", reponses: ["Could"], explication: "“Could” makes the request polite." },
    { intitule: "At the restaurant", consigne: "Complete the order.", enonce: "I ___ a coffee, please.", reponses: ["would like", "want", "take"], explication: "“I would like” is the most polite way to order." },
  ],
  ecoutes: [
    { intitule: "A voicemail", texte: "Hi, this is Paul. I'll be ten minutes late. See you soon!", question: "What does Paul say?", choix: ["He cancels the meeting", "He will be late", "He has already arrived"], reponse: "He will be late", explication: "Paul says: “I'll be ten minutes late”." },
    { intitule: "At the station", texte: "The train for Leeds leaves from platform three at two p.m.", question: "Which platform does the train leave from?", choix: ["Platform 1", "Platform 3", "Platform 14"], reponse: "Platform 3", explication: "The announcement says “platform three”; two p.m. is the departure time." },
    { intitule: "The weather", texte: "Tomorrow it will rain in the morning, then the sun will come out in the afternoon.", question: "What will the weather be like tomorrow afternoon?", choix: ["Rain", "Sun", "Snow"], reponse: "Sun", explication: "“The sun will come out in the afternoon”; the rain is in the morning." },
  ],
  prononciations: [
    { intitule: "Introducing yourself", phrase: "Hello, my name is Marie and I live in London." },
    { intitule: "Ordering", phrase: "I'd like a coffee and a croissant, please." },
    { intitule: "Asking for directions", phrase: "Excuse me, where is the station?" },
  ],
  conversations: [
    { intitule: "Getting to know you", sujet: "Introducing yourself", message_initial: "Hello! I'm your AI tutor. What's your name?", relances: ["Nice to meet you! Where are you from?", "And what do you do?", "What do you like doing at the weekend?"] },
    { intitule: "At the restaurant", sujet: "Ordering a meal", message_initial: "Good evening and welcome! Have you chosen your dish?", relances: ["Good choice. And what would you like to drink?", "Would you like a dessert?", "Perfect. Are you paying by card or in cash?"] },
    { intitule: "Planning an outing", sujet: "Suggesting an activity", message_initial: "Hi! Shall we go out this weekend? What do you suggest?", relances: ["Good idea! Which day suits you?", "What time shall we meet?", "Where shall we meet?"] },
  ],
  redactions: [
    { intitule: "Describing your weekend", enonce: "Write a few sentences about your last weekend: where were you, who with, and what did you do?" },
    { intitule: "Writing to a friend", enonce: "Write a short message to a friend suggesting an outing on Saturday." },
    { intitule: "Describing your city", enonce: "Describe your city or neighbourhood: what you like and what you like less." },
  ],
  recommandations: [
    { domaine: "grammaire", type_exercice: "GRAMMAIRE", action: "Review the simple past of irregular verbs.", justification: "The past forms are still hesitating in your answers." },
    { domaine: "vocabulaire", type_exercice: "VOCABULAIRE", action: "Revise vocabulary for directions and transport.", justification: "A few words about journeys are missing." },
  ],
  resumeRecommandation: "Two short actions: grammar first, then transport vocabulary.",
  messages: {
    consigneChoix: "Choose the correct form.",
    consigneEcoute: "Listen to the extract, then answer.",
    consignePrononciation: "Read the sentence aloud.",
    consigneRedaction: "Write your answer; the AI teacher will correct it.",
    consigneConversation: "Talk with the AI tutor, in writing or by voice.",
    conversationOk: "Great conversation! Your answers were clear and appropriate.",
    conversationKo: "Keep the exchange going: answer at least three of the tutor's questions.",
    pointFortConversation: "You answered in the language you are learning.",
    conseilConversation: "Try asking the tutor a question too.",
    prononciationBon: "Great pronunciation!",
    prononciationMoyen: "Good! A few words were not recognised.",
    prononciationFaible: "Try again, pronouncing each word clearly.",
    bonneReponse: "Correct answer!",
    mauvaiseReponse: "That's not the right answer.",
    texteBon: "Very good text, clear and well structured.",
    texteMoyen: "Good work! A few points need correcting.",
    texteFaible: "Your text needs to be expanded and corrected.",
    majusculeExplication: "A sentence starts with a capital letter.",
    pointExplication: "End each sentence with a full stop.",
    pointFinal: ".",
    texteDeveloppe: (nombre) => `Long enough text (${nombre} words).`,
    texteManque: (minimum, manque) => `Write more: at least ${minimum} words (${manque} missing).`,
    conseilRelire: "Read the lesson of the day aloud: these forms will become natural.",
    conseilComparer: "Compare your text with the corrected version, then rewrite it without looking.",
    conseilOpinion: "Now try adding a personal opinion (“In my view…”).",
    traductionPrefix: (reponse) => `French translation (demo): “${reponse}”.`,
    traductionExplication: "Explanation (demo): rephrase this sentence in your own words; a language model provides a detailed translation and explanation.",
    reponseCourte: "Please answer with a full sentence. For example: “My name is…”.",
    reactions: ["Very good!", "OK, thank you.", "Interesting!"],
    relanceFin: "Thank you for this exchange, you can finish the conversation.",
    exerciceCibleEnonce: (erreur) => `Rewrite “${erreur}” in the past.`,
    exerciceCibleConsigne: (typeErreur) => `Demo exercise focused on ${typeErreur}.`,
    descripteurId: "cecrl-a1-grammar-1",
  },
};

const IT: PackParcoursMock = {
  code: "it",
  libelle: "Italien",
  cadre: "CECRL",
  niveaux: ["A1", "A2", "B1", "B2", "C1", "C2"],
  modules: [
    { titre: "Primi contatti", description: "Salutare, presentarsi, scrivere il proprio nome." },
    { titre: "Vita quotidiana", description: "Parlare della giornata, della famiglia e della casa." },
    { titre: "Spostarsi e orientarsi", description: "Chiedere indicazioni e usare i mezzi pubblici." },
    { titre: "Tempo libero e gusti", description: "Esprimere le preferenze e proporre un'uscita." },
    { titre: "Lavoro e studi", description: "Parlare del lavoro, della formazione e dei progetti." },
    { titre: "Salute e benessere", description: "Descrivere un sintomo e prenotare una visita." },
    { titre: "Società e attualità", description: "Capire una notizia e reagire." },
    { titre: "Esprimersi e argomentare", description: "Esprimere un'opinione, sfumare, convincere." },
  ],
  choix: [
    { type: "GRAMMAIRE", intitule: "Il passato prossimo", consigne: "Scegli la forma corretta.", enonce: "Ieri ___ al cinema.", choix: ["sono andato", "vado", "andrò"], reponse: "sono andato", explication: "“Ieri” indica il passato: con “andare” si usa l'ausiliare “essere”." },
    { type: "GRAMMAIRE", intitule: "Il futuro semplice", consigne: "Scegli la forma corretta.", enonce: "Stasera ___ a cena da amici.", choix: ["andremo", "siamo andati", "andavamo"], reponse: "andremo", explication: "“Stasera” indica il futuro: si usa il futuro semplice." },
    { type: "COMPREHENSION", intitule: "Leggere un avviso", consigne: "« Il museo è aperto da martedì a domenica, dalle 10 alle 18. »", enonce: "Si può visitare il museo il lunedì?", choix: ["Sì", "No", "Solo la mattina"], reponse: "No", explication: "Il museo è aperto da martedì a domenica: il lunedì è chiuso." },
    { type: "COMPREHENSION", intitule: "Capire un messaggio", consigne: "« Appuntamento davanti alla stazione alle 9, non fare tardi! »", enonce: "Dov'è l'appuntamento?", choix: ["Alla stazione", "Al bar", "A scuola"], reponse: "Alla stazione", explication: "Il messaggio dice « davanti alla stazione »." },
  ],
  textes: [
    { intitule: "I saluti", consigne: "Completa la frase.", enonce: "___, mi chiamo Marie.", reponses: ["Buongiorno", "Buonasera", "Ciao"], explication: "Una presentazione comincia con un saluto: « Buongiorno », « Buonasera » o « Ciao »." },
    { intitule: "Prendere un appuntamento", consigne: "Completa con il verbo giusto.", enonce: "Vorrei ___ un appuntamento dal medico.", reponses: ["prendere"], explication: "Si dice « prendere un appuntamento »." },
    { intitule: "Chiedere con cortesia", consigne: "Completa con il condizionale di « potere ».", enonce: "___ mi indicare la stazione, per favore?", reponses: ["Potrebbe"], explication: "« Potrebbe » è il condizionale di cortesia con « Lei »." },
    { intitule: "Al ristorante", consigne: "Completa l'ordinazione.", enonce: "___ un caffè, per favore.", reponses: ["Vorrei", "Voglio", "Prendo"], explication: "« Vorrei » è la forma più cortese per ordinare." },
  ],
  ecoutes: [
    { intitule: "Un messaggio vocale", texte: "Ciao, sono Paolo. Avrò dieci minuti di ritardo. A presto!", question: "Cosa dice Paolo?", choix: ["Annulla l'appuntamento", "Sarà in ritardo", "È già arrivato"], reponse: "Sarà in ritardo", explication: "Paolo dice: « Avrò dieci minuti di ritardo »." },
    { intitule: "Alla stazione", texte: "Il treno per Milano parte dal binario tre alle quattordici.", question: "Da quale binario parte il treno?", choix: ["Binario 1", "Binario 3", "Binario 14"], reponse: "Binario 3", explication: "L'annuncio dice « binario tre »; le quattordici è l'orario." },
    { intitule: "Il tempo", texte: "Domani pioverà la mattina, poi uscirà il sole nel pomeriggio.", question: "Che tempo farà domani pomeriggio?", choix: ["Pioggia", "Sole", "Neve"], reponse: "Sole", explication: "« Uscirà il sole nel pomeriggio »; la pioggia è la mattina." },
  ],
  prononciations: [
    { intitule: "Presentarsi", phrase: "Buongiorno, mi chiamo Marie e abito a Parigi." },
    { intitule: "Ordinare", phrase: "Vorrei un caffè e un cornetto, per favore." },
    { intitule: "Chiedere indicazioni", phrase: "Mi scusi, dov'è la stazione?" },
  ],
  conversations: [
    { intitule: "Conoscersi", sujet: "Presentarsi", message_initial: "Buongiorno! Sono il tuo tutor IA. Come ti chiami?", relances: ["Piacere! Da dove vieni?", "E che lavoro fai?", "Cosa ti piace fare nel weekend?"] },
    { intitule: "Al ristorante", sujet: "Ordinare un pasto", message_initial: "Buonasera e benvenuto! Hai scelto il piatto?", relances: ["Ottima scelta. E da bere?", "Prendi un dolce?", "Perfetto. Paghi con carta o in contanti?"] },
    { intitule: "Organizzare un'uscita", sujet: "Proporre un'attività", message_initial: "Ciao! Usciamo questo weekend? Cosa proponi?", relances: ["Bella idea! Che giorno ti va bene?", "A che ora ci vediamo?", "Dove ci incontriamo?"] },
  ],
  redactions: [
    { intitule: "Raccontare il weekend", enonce: "Racconta il tuo ultimo weekend in poche frasi: dov'eri, con chi, cosa hai fatto?" },
    { intitule: "Scrivere a un amico", enonce: "Scrivi un breve messaggio a un amico per proporgli un'uscita sabato." },
    { intitule: "Descrivere la città", enonce: "Descrivi la tua città o il tuo quartiere: cosa ti piace e cosa ti piace meno." },
  ],
  recommandations: [
    { domaine: "grammaire", type_exercice: "GRAMMAIRE", action: "Rivedere il passato prossimo dei verbi irregolari.", justification: "Le forme del passato sono ancora incerte nelle tue risposte." },
    { domaine: "vocabulaire", type_exercice: "VOCABULAIRE", action: "Ripassare il vocabolario degli spostamenti e delle indicazioni.", justification: "Mancano alcuni termini relativi al tragitto." },
  ],
  resumeRecommandation: "Due attività brevi: prima la grammatica, poi il vocabolario degli spostamenti.",
  messages: {
    consigneChoix: "Scegli la forma corretta.",
    consigneEcoute: "Ascolta il brano, poi rispondi.",
    consignePrononciation: "Leggi la frase ad alta voce.",
    consigneRedaction: "Scrivi la tua risposta; l'insegnante IA la correggerà.",
    consigneConversation: "Parla con il tutor IA, per iscritto o a voce.",
    conversationOk: "Ottima conversazione! Le tue risposte erano chiare e appropriate.",
    conversationKo: "Continua lo scambio: rispondi ad almeno tre domande dell'insegnante.",
    pointFortConversation: "Hai risposto nella lingua che stai imparando.",
    conseilConversation: "Prova a fare anche tu una domanda all'insegnante.",
    prononciationBon: "Ottima pronuncia!",
    prononciationMoyen: "Bene! Alcune parole non sono state riconosciute.",
    prononciationFaible: "Riprova, pronunciando ogni parola con chiarezza.",
    bonneReponse: "Risposta corretta!",
    mauvaiseReponse: "Non è la risposta giusta.",
    texteBon: "Ottimo testo, chiaro e ben strutturato.",
    texteMoyen: "Buon lavoro! Alcuni punti vanno corretti.",
    texteFaible: "Il tuo testo va completato e corretto.",
    majusculeExplication: "Una frase inizia con la maiuscola.",
    pointExplication: "Termina ogni frase con un punto.",
    pointFinal: ".",
    texteDeveloppe: (nombre) => `Testo abbastanza sviluppato (${nombre} parole).`,
    texteManque: (minimum, manque) => `Sviluppa di più: scrivi almeno ${minimum} parole (ne mancano ${manque}).`,
    conseilRelire: "Rileggi ad alta voce la lezione del giorno: queste forme diventeranno naturali.",
    conseilComparer: "Confronta il tuo testo con la versione corretta, poi riscrivilo senza guardare.",
    conseilOpinion: "Ora prova ad aggiungere un'opinione personale (« Secondo me… »).",
    traductionPrefix: (reponse) => `Traduzione francese (demo): « ${reponse} ».`,
    traductionExplication: "Spiegazione (demo): riformula questa frase con parole tue; un modello linguistico fornisce una traduzione e una spiegazione dettagliate.",
    reponseCourte: "Puoi rispondere con una frase completa? Per esempio: « Mi chiamo… ».",
    reactions: ["Molto bene!", "Va bene, grazie.", "Interessante!"],
    relanceFin: "Grazie per lo scambio, puoi concludere la conversazione.",
    exerciceCibleEnonce: (erreur) => `Riscrivi « ${erreur} » al passato.`,
    exerciceCibleConsigne: (typeErreur) => `Esercizio di demo incentrato su ${typeErreur}.`,
    descripteurId: "cecrl-a1-grammatica-1",
  },
};

const DE: PackParcoursMock = {
  code: "de",
  libelle: "Allemand",
  cadre: "CECRL",
  niveaux: ["A1", "A2", "B1", "B2", "C1", "C2"],
  modules: [
    { titre: "Erste Kontakte", description: "Begrüßen, sich vorstellen, den Namen buchstabieren." },
    { titre: "Alltag", description: "Über den Tag, die Familie und das Zuhause sprechen." },
    { titre: "Unterwegs", description: "Nach dem Weg fragen und öffentliche Verkehrsmittel nutzen." },
    { titre: "Freizeit und Interessen", description: "Vorlieben äußern und etwas vorschlagen." },
    { titre: "Arbeit und Studium", description: "Über Beruf, Ausbildung und Pläne sprechen." },
    { titre: "Gesundheit und Wohlbefinden", description: "Ein Symptom beschreiben und einen Termin vereinbaren." },
    { titre: "Gesellschaft und Nachrichten", description: "Eine Nachricht verstehen und darauf reagieren." },
    { titre: "Meinung äußern", description: "Eine Meinung vertreten, nuancieren und überzeugen." },
  ],
  choix: [
    { type: "GRAMMAIRE", intitule: "Das Perfekt", consigne: "Wählen Sie die richtige Form.", enonce: "Gestern ___ ich ins Kino.", choix: ["bin", "habe", "werde"], reponse: "bin", explication: "„Gestern“ verweist auf die Vergangenheit: mit „gehen“ verwendet man „sein“." },
    { type: "GRAMMAIRE", intitule: "Das Futur mit werden", consigne: "Wählen Sie die richtige Form.", enonce: "Heute Abend ___ wir bei Freunden zu Abend essen.", choix: ["werden", "sind", "waren"], reponse: "werden", explication: "„Heute Abend“ kündigt die Zukunft an: werden + Infinitiv." },
    { type: "COMPREHENSION", intitule: "Eine Anzeige lesen", consigne: "„Das Museum ist von Dienstag bis Sonntag, 10 bis 18 Uhr geöffnet.“", enonce: "Kann man am Montag ins Museum gehen?", choix: ["Ja", "Nein", "Nur morgens"], reponse: "Nein", explication: "Das Museum ist von Dienstag bis Sonntag offen, am Montag also geschlossen." },
    { type: "COMPREHENSION", intitule: "Eine Nachricht verstehen", consigne: "„Treffen wir uns um 9 Uhr vor dem Bahnhof, komm nicht zu spät!“", enonce: "Wo ist das Treffen?", choix: ["Am Bahnhof", "Im Café", "In der Schule"], reponse: "Am Bahnhof", explication: "Die Nachricht sagt „vor dem Bahnhof“." },
  ],
  textes: [
    { intitule: "Begrüßungen", consigne: "Vervollständigen Sie den Satz.", enonce: "___, ich heiße Marie.", reponses: ["Guten Tag", "Guten Abend", "Hallo"], explication: "Eine Vorstellung beginnt mit einer Begrüßung: „Guten Tag“, „Guten Abend“ oder „Hallo“." },
    { intitule: "Einen Termin vereinbaren", consigne: "Ergänzen Sie das richtige Verb.", enonce: "Ich möchte einen Termin beim Arzt ___.", reponses: ["vereinbaren"], explication: "Man sagt „einen Termin vereinbaren“." },
    { intitule: "Höflich fragen", consigne: "Ergänzen Sie im Konjunktiv.", enonce: "___ Sie mir den Bahnhof zeigen, bitte?", reponses: ["Könnten"], explication: "„Könnten“ ist der höfliche Konjunktiv von „können“." },
    { intitule: "Im Restaurant", consigne: "Vervollständigen Sie die Bestellung.", enonce: "Ich ___ einen Kaffee, bitte.", reponses: ["hätte", "will", "nehme"], explication: "„Ich hätte“ ist die höflichste Form zum Bestellen." },
  ],
  ecoutes: [
    { intitule: "Eine Nachricht", texte: "Hallo, hier ist Paul. Ich komme zehn Minuten zu spät. Bis gleich!", question: "Was sagt Paul?", choix: ["Er sagt die Verabredung ab", "Er kommt zu spät", "Er ist schon da"], reponse: "Er kommt zu spät", explication: "Paul sagt: „Ich komme zehn Minuten zu spät“." },
    { intitule: "Am Bahnhof", texte: "Der Zug nach Lyon fährt um vierzehn Uhr von Gleis drei ab.", question: "Von welchem Gleis fährt der Zug ab?", choix: ["Gleis 1", "Gleis 3", "Gleis 14"], reponse: "Gleis 3", explication: "Die Durchsage sagt „Gleis drei“; vierzehn Uhr ist die Abfahrtszeit." },
    { intitule: "Das Wetter", texte: "Morgen regnet es am Morgen, am Nachmittag kommt die Sonne.", question: "Wie wird das Wetter morgen Nachmittag?", choix: ["Regen", "Sonne", "Schnee"], reponse: "Sonne", explication: "„Am Nachmittag kommt die Sonne“; der Regen ist am Morgen." },
  ],
  prononciations: [
    { intitule: "Sich vorstellen", phrase: "Guten Tag, ich heiße Marie und wohne in Paris." },
    { intitule: "Bestellen", phrase: "Ich hätte einen Kaffee und ein Croissant, bitte." },
    { intitule: "Nach dem Weg fragen", phrase: "Entschuldigung, wo ist der Bahnhof?" },
  ],
  conversations: [
    { intitule: "Sich kennenlernen", sujet: "Sich vorstellen", message_initial: "Hallo! Ich bin Ihr KI-Tutor. Wie heißen Sie?", relances: ["Freut mich! Woher kommen Sie?", "Und was machen Sie beruflich?", "Was machen Sie am Wochenende gern?"] },
    { intitule: "Im Restaurant", sujet: "Ein Essen bestellen", message_initial: "Guten Abend und willkommen! Haben Sie schon gewählt?", relances: ["Gute Wahl. Und was möchten Sie trinken?", "Möchten Sie ein Dessert?", "Perfekt. Zahlen Sie mit Karte oder bar?"] },
    { intitule: "Etwas unternehmen", sujet: "Eine Aktivität vorschlagen", message_initial: "Hallo! Wollen wir am Wochenende etwas machen? Was schlagen Sie vor?", relances: ["Gute Idee! Welcher Tag passt?", "Um wie viel Uhr treffen wir uns?", "Wo treffen wir uns?"] },
  ],
  redactions: [
    { intitule: "Das Wochenende erzählen", enonce: "Erzählen Sie von Ihrem letzten Wochenende: wo waren Sie, mit wem und was haben Sie gemacht?" },
    { intitule: "Einem Freund schreiben", enonce: "Schreiben Sie eine kurze Nachricht und schlagen Sie ein Treffen am Samstag vor." },
    { intitule: "Die Stadt beschreiben", enonce: "Beschreiben Sie Ihre Stadt oder Ihr Viertel: was gefällt Ihnen, was gefällt Ihnen weniger?" },
  ],
  recommandations: [
    { domaine: "grammaire", type_exercice: "GRAMMAIRE", action: "Das Perfekt unregelmäßiger Verben wiederholen.", justification: "Die Vergangenheitsformen sind in Ihren Antworten noch unsicher." },
    { domaine: "vocabulaire", type_exercice: "VOCABULAIRE", action: "Wortschatz für Wege und Verkehrsmittel üben.", justification: "Einige Wörter rund um die Strecke fehlen." },
  ],
  resumeRecommandation: "Zwei kurze Aufgaben: zuerst Grammatik, dann Wortschatz für unterwegs.",
  messages: {
    consigneChoix: "Wählen Sie die richtige Form.",
    consigneEcoute: "Hören Sie den Text und antworten Sie.",
    consignePrononciation: "Lesen Sie den Satz laut vor.",
    consigneRedaction: "Schreiben Sie Ihre Antwort; die KI-Lehrkraft korrigiert sie.",
    consigneConversation: "Sprechen Sie mit dem KI-Tutor, schriftlich oder mündlich.",
    conversationOk: "Sehr gutes Gespräch! Ihre Antworten waren klar und passend.",
    conversationKo: "Setzen Sie das Gespräch fort: antworten Sie auf mindestens drei Fragen.",
    pointFortConversation: "Sie haben in der Sprache geantwortet, die Sie lernen.",
    conseilConversation: "Stellen Sie der Lehrkraft auch einmal eine Frage.",
    prononciationBon: "Sehr gute Aussprache!",
    prononciationMoyen: "Gut! Einige Wörter wurden nicht erkannt.",
    prononciationFaible: "Versuchen Sie es erneut und sprechen Sie jedes Wort deutlich aus.",
    bonneReponse: "Richtige Antwort!",
    mauvaiseReponse: "Das ist nicht die richtige Antwort.",
    texteBon: "Sehr guter Text, klar und gut aufgebaut.",
    texteMoyen: "Gute Arbeit! Einige Punkte müssen korrigiert werden.",
    texteFaible: "Ihr Text muss ergänzt und korrigiert werden.",
    majusculeExplication: "Ein Satz beginnt mit einem Großbuchstaben.",
    pointExplication: "Beenden Sie jeden Satz mit einem Punkt.",
    pointFinal: ".",
    texteDeveloppe: (nombre) => `Ausreichend langer Text (${nombre} Wörter).`,
    texteManque: (minimum, manque) => `Schreiben Sie mehr: mindestens ${minimum} Wörter (${manque} fehlen).`,
    conseilRelire: "Lesen Sie die Lektion des Tages laut: diese Formen werden natürlicher.",
    conseilComparer: "Vergleichen Sie Ihren Text mit der korrigierten Version und schreiben Sie ihn ohne hinzusehen neu.",
    conseilOpinion: "Fügen Sie jetzt eine persönliche Meinung hinzu („Meiner Ansicht nach…“).",
    traductionPrefix: (reponse) => `Französische Übersetzung (Demo): „${reponse}“.`,
    traductionExplication: "Erklärung (Demo): formulieren Sie den Satz mit eigenen Worten um; ein Sprachmodell liefert eine ausführliche Übersetzung und Erklärung.",
    reponseCourte: "Können Sie mit einem vollständigen Satz antworten? Zum Beispiel: „Ich heiße…“.",
    reactions: ["Sehr gut!", "Okay, danke.", "Interessant!"],
    relanceFin: "Vielen Dank für das Gespräch, Sie können es hier beenden.",
    exerciceCibleEnonce: (erreur) => `Schreiben Sie „${erreur}“ in der Vergangenheit neu.`,
    exerciceCibleConsigne: (typeErreur) => `Demo-Übung zu ${typeErreur}.`,
    descripteurId: "cecrl-a1-grammatik-1",
  },
};

const ZH: PackParcoursMock = {
  code: "zh",
  libelle: "Mandarin",
  cadre: "HSK",
  niveaux: ["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"],
  modules: [
    { titre: "初次接触", description: "打招呼、自我介绍、拼写名字。" },
    { titre: "日常生活", description: "谈论一天、家庭和住处。" },
    { titre: "出行与指路", description: "问路、乘坐交通工具。" },
    { titre: "爱好与兴趣", description: "表达喜好、提议活动。" },
    { titre: "工作与学习", description: "谈论职业、培训和计划。" },
    { titre: "健康与养生", description: "描述症状、预约看病。" },
    { titre: "社会与新闻", description: "看懂一条信息并作出回应。" },
    { titre: "表达与论证", description: "提出观点、加以说明、说服别人。" },
  ],
  choix: [
    { type: "GRAMMAIRE", intitule: "“了”的用法", consigne: "选择正确的形式。", enonce: "昨天我 ___ 电影院。", choix: ["去", "去了", "要去"], reponse: "去了", explication: "“昨天”表示过去，动词后加“了”。" },
    { type: "GRAMMAIRE", intitule: "表示将来", consigne: "选择正确的形式。", enonce: "今晚我们 ___ 去朋友家吃饭。", choix: ["要", "了", "过"], reponse: "要", explication: "“今晚”表示将来，用“要”表示打算。" },
    { type: "COMPREHENSION", intitule: "阅读通知", consigne: "“博物馆周二至周日开放，10点到18点。”", enonce: "周一能参观博物馆吗？", choix: ["能", "不能", "只能上午"], reponse: "不能", explication: "博物馆周二至周日开放，所以周一闭馆。" },
    { type: "COMPREHENSION", intitule: "理解留言", consigne: "“九点在火车站前见，别迟到！”", enonce: "在哪里见面？", choix: ["火车站", "咖啡馆", "学校"], reponse: "火车站", explication: "留言说“在火车站前”。" },
  ],
  textes: [
    { intitule: "打招呼", consigne: "补全句子。", enonce: "___，我叫玛丽。", reponses: ["你好", "再见", "谢谢"], explication: "介绍自己之前通常先打招呼：“你好”。" },
    { intitule: "预约", consigne: "填入合适的动词。", enonce: "我想 ___ 一个看医生的预约。", reponses: ["约"], explication: "“约一个预约”是常见说法。" },
    { intitule: "礼貌请求", consigne: "用“能”补全句子。", enonce: "___ 告诉我火车站在哪里吗？", reponses: ["能"], explication: "“能”让请求更有礼貌。" },
    { intitule: "在餐厅", consigne: "补全点餐。", enonce: "我 ___ 一杯咖啡。", reponses: ["要", "了", "过"], explication: "点餐时用“我要……”。" },
  ],
  ecoutes: [
    { intitule: "一条语音", texte: "你好，我是保罗。我会迟到十分钟。待会儿见！", question: "保罗说了什么？", choix: ["他取消见面", "他会迟到", "他已经到了"], reponse: "他会迟到", explication: "保罗说：“我会迟到十分钟”。" },
    { intitule: "在火车站", texte: "去里昂的火车十四点从三站台出发。", question: "火车从哪个站台出发？", choix: ["一站台", "三站台", "十四站台"], reponse: "三站台", explication: "广播说“三站台”；十四点是发车时间。" },
    { intitule: "天气", texte: "明早下雨，下午天晴。", question: "明天下午天气怎么样？", choix: ["下雨", "晴天", "下雪"], reponse: "晴天", explication: "“下午天晴”；下雨是在早上。" },
  ],
  prononciations: [
    { intitule: "自我介绍", phrase: "你好，我叫玛丽，我住在巴黎。" },
    { intitule: "点餐", phrase: "我要一杯咖啡和一个羊角面包，谢谢。" },
    { intitule: "问路", phrase: "请问，火车站在哪里？" },
  ],
  conversations: [
    { intitule: "认识彼此", sujet: "自我介绍", message_initial: "你好！我是你的 AI 老师。你叫什么名字？", relances: ["很高兴认识你！你从哪里来？", "你做什么工作？", "周末你喜欢做什么？"] },
    { intitule: "在餐厅", sujet: "点餐", message_initial: "晚上好，欢迎！你选好菜了吗？", relances: ["好选择。你想喝什么？", "要甜点吗？", "很好。你刷卡还是付现金？"] },
    { intitule: "安排活动", sujet: "提议活动", message_initial: "嗨！这周末出去玩吗？你有什么建议？", relances: ["好主意！哪天合适？", "几点见面？", "在哪里见面？"] },
  ],
  redactions: [
    { intitule: "写周末", enonce: "用几句话写你的上一个周末：在哪里、和谁、做了什么？" },
    { intitule: "给朋友写信", enonce: "写一条短消息，邀请朋友周六出去。" },
    { intitule: "描述城市", enonce: "描述你的城市或街区：喜欢什么，不喜欢什么。" },
  ],
  recommandations: [
    { domaine: "grammaire", type_exercice: "GRAMMAIRE", action: "复习“了”表示过去的用法。", justification: "你的回答里过去时的形式还不太稳定。" },
    { domaine: "vocabulaire", type_exercice: "VOCABULAIRE", action: "练习问路和交通词汇。", justification: "与路线有关的词语还缺少一些。" },
  ],
  resumeRecommandation: "两个短任务：先复习语法，再练出行词汇。",
  messages: {
    consigneChoix: "选择正确的形式。",
    consigneEcoute: "听录音，然后回答。",
    consignePrononciation: "大声朗读句子。",
    consigneRedaction: "写出你的回答，AI 老师会批改。",
    consigneConversation: "和 AI 老师交流，可以打字或语音。",
    conversationOk: "很好！你的回答清楚又得体。",
    conversationKo: "继续对话：至少回答老师的三个问题。",
    pointFortConversation: "你用正在学习的语言回答了。",
    conseilConversation: "也可以试着向老师提问。",
    prononciationBon: "发音很好！",
    prononciationMoyen: "不错！有几个字没听清。",
    prononciationFaible: "再试一次，把每个字读清楚。",
    bonneReponse: "回答正确！",
    mauvaiseReponse: "这不是正确答案。",
    texteBon: "文章清楚，结构很好。",
    texteMoyen: "不错！还有几处需要修改。",
    texteFaible: "文章还需要补充和修改。",
    majusculeExplication: "中文不区分大小写。",
    pointExplication: "每句话以句号结尾。",
    pointFinal: "。",
    texteDeveloppe: (nombre) => `字数足够（${nombre} 个字）。`,
    texteManque: (minimum, manque) => `再写长一点：至少 ${minimum} 个字（还差 ${manque} 个）。`,
    conseilRelire: "朗读今天的课文：这些表达会越来越自然。",
    conseilComparer: "把你的文章和修改版对比，然后不看再写一遍。",
    conseilOpinion: "现在试着加上自己的观点（“我认为……”）。",
    traductionPrefix: (reponse) => `法语翻译（演示）：「${reponse}」。`,
    traductionExplication: "说明（演示）：用自己的话复述这句话；语言模型会给出详细翻译和解释。",
    reponseCourte: "请用完整的句子回答，例如：「我叫……」。",
    reactions: ["很好！", "好的，谢谢。", "有意思！"],
    relanceFin: "谢谢交流，可以结束对话了。",
    exerciceCibleEnonce: (erreur) => `把「${erreur}」改写成过去时。`,
    exerciceCibleConsigne: (typeErreur) => `针对 ${typeErreur} 的演示练习。`,
    descripteurId: "hsk1-grammaire-1",
  },
};

export const PACKS_PARCOURS_MOCK: Record<CodeLangueParcoursMock, PackParcoursMock> = {
  fr: FR,
  en: EN,
  zh: ZH,
  it: IT,
  de: DE,
};

/** Normalise un code du backend (`fr`, `en`, `zh`, `it`, `de`) ; une langue non prévue reste en français. */
export function packParcoursMock(codeLangue: string | undefined | null): PackParcoursMock {
  const code = (codeLangue ?? "").toLowerCase().slice(0, 2);
  return PACKS_PARCOURS_MOCK[code as CodeLangueParcoursMock] ?? FR;
}
