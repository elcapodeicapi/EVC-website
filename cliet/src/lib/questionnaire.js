export const QUESTIONNAIRE_SECTIONS = [
  {
    id: "werknemer",
    title: "De economische dimensie: functioneren als werknemer in een arbeidsorganisatie",
    instruction:
      "Beschrijf hoe u zich als een goede werknemer gedraagt. Vertel bijvoorbeeld hoe u omgaat met collega's, hoe u op de hoogte blijft van regels en procedures, hoe u uw rechten als werknemer kent, of hoe u omgaat met overwerk en stress.",
  },
  {
    id: "politiek",
    title: "Burgerschap: de politiek-juridische dimensie",
    instruction:
      "Vertel hoe u zich een mening vormt over politieke onderwerpen. Geef aan of u stemt bij verkiezingen, hoe u beslist op wie u stemt en welke thema’s u belangrijk vindt in de politiek.",
  },
  {
    id: "consument",
    title: "De economische dimensie: functioneren als kritisch consument",
    instruction:
      "Beschrijf uw gedrag als consument. Vertel hoe u beslissingen neemt over aankopen of het kiezen van een dienstverlener. Denk aan het verzamelen van informatie, letten op aanbiedingen, onderhandelen over prijzen en het bewaken van uw uitgaven.",
  },
  {
    id: "sociaal",
    title: "De sociaal-maatschappelijke dimensie: deelnemen in sociale verbanden",
    instruction:
      "Beschrijf hoe u deelneemt aan sociale verbanden en wat u doet om de leefbaarheid van uw omgeving te versterken. Vertel bijvoorbeeld over vrijwilligerswerk, verenigingen, goede doelen of manieren waarop u anderen helpt.",
  },
  {
    id: "vitaal",
    title: "De dimensie vitaal burgerschap: zorgen voor de eigen gezondheid en die van anderen",
    instruction:
      "Beschrijf hoe u met uw gezondheid omgaat en hoe u rekening houdt met de gezondheid van anderen. Denk aan sport, voeding, stoppen met roken, het zoeken van informatie en weten waar u hulp kunt vinden.",
  },
  {
    id: "loopbaan",
    title: "Loopbaan: sturen van de eigen loopbaan",
    instruction:
      "Vertel hoe u uw loopbaan richting geeft. Beschrijf uw sterke kanten, wat u wilt leren, welke baan goed bij u past en welke stappen u wilt zetten om uw toekomstige doelen te bereiken.",
  },
];

export const QUESTIONNAIRE_SECTION_IDS = QUESTIONNAIRE_SECTIONS.map((section) => section.id);

export const emptyQuestionnaireResponses = () =>
  QUESTIONNAIRE_SECTION_IDS.reduce((acc, sectionId) => {
    acc[sectionId] = "";
    return acc;
  }, {});

export const normalizeQuestionnaireResponses = (rawResponses = {}) => {
  const result = emptyQuestionnaireResponses();
  QUESTIONNAIRE_SECTION_IDS.forEach((sectionId) => {
    const value = rawResponses?.[sectionId];
    result[sectionId] = typeof value === "string" ? value.trim() : "";
  });
  return result;
};

export const questionnaireIsComplete = (responses = {}) => {
  return QUESTIONNAIRE_SECTION_IDS.every((sectionId) => {
    const value = responses?.[sectionId];
    return typeof value === "string" && value.trim().length > 0;
  });
};
