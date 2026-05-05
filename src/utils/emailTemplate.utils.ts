const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export const extractTemplateVariables = (templateBody: string): string[] => {
  const variableNames = new Set<string>();
  const matchedVariables = templateBody.matchAll(TEMPLATE_VARIABLE_PATTERN);
  for (const variableMatch of matchedVariables) {
    const variableName = variableMatch[1];
    if (variableName) {
      variableNames.add(variableName);
    }
  }
  return Array.from(variableNames).sort();
};

export const sanitizeHtmlTemplate = (rawHtmlBody: string): string =>
  rawHtmlBody
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+=(['"]).*?\1/gi, "")
    .trim();

export const renderEmailTemplateBody = (
  templateBody: string,
  templateVariables: Record<string, string>,
): { renderedBody: string; unresolvedVariables: string[] } => {
  const unresolvedVariables = new Set<string>();
  const renderedBody = templateBody.replace(
    TEMPLATE_VARIABLE_PATTERN,
    (_fullMatch, variableName: string) => {
      const variableValue = templateVariables[variableName];
      if (variableValue === undefined) {
        unresolvedVariables.add(variableName);
        return "";
      }
      return variableValue;
    },
  );

  return {
    renderedBody,
    unresolvedVariables: Array.from(unresolvedVariables).sort(),
  };
};
