export function journalPromptAnswerKey(sectionId: string, promptId: string): string {
  return `${sectionId}:${promptId}`;
}

export function journalPromptStorageIds(prompts: Array<{ id: string }>): string[] {
  const totals = new Map<string, number>();
  const seen = new Map<string, number>();

  for (const prompt of prompts) {
    totals.set(prompt.id, (totals.get(prompt.id) ?? 0) + 1);
  }

  return prompts.map((prompt) => {
    const occurrence = (seen.get(prompt.id) ?? 0) + 1;
    seen.set(prompt.id, occurrence);

    if ((totals.get(prompt.id) ?? 0) <= 1 || occurrence === 1) {
      return prompt.id;
    }

    return `${prompt.id}#${occurrence}`;
  });
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
