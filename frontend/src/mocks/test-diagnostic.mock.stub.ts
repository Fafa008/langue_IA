const mockModeDisabled = (): never => {
  throw new Error("Le service simulé du test de positionnement est désactivé.");
};

export const testDiagnosticMockService = {
  langues: mockModeDisabled,
  demarrer: mockModeDisabled,
  repondre: mockModeDisabled,
};
