export function journalPromptAnswerKey(sectionId: string, promptId: string): string {
  return `${sectionId}:${promptId}`;
}

export function journalSectionReflectionKey(sectionId: string): string {
  return journalPromptAnswerKey(sectionId, "reflection");
}

export function resolveJournalAnswer(
  answers: Record<string, string>,
  sectionId: string,
  promptId: string
): string {
  return answers[journalPromptAnswerKey(sectionId, promptId)] ?? answers[promptId] ?? "";
}
