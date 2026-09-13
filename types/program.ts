export type Program = {
  program: ProgramMetadata;
  weeks: ProgramWeek[];
};

export type ProgramMetadata = {
  id: string;
  title: string;
  version: string;
  description?: string;
};

export type ProgramWeek = {
  weekNumber: number;
  title: string;
  summary?: string;
  days: ProgramDay[];
};

export type ProgramDay = {
  dayNumber: number;
  label?: string;
  title: string;
  sections: ProgramSection[];
};

export type ProgramSection = {
  id: string;
  title: string;
  body?: string;
  completionUnit?: string;
  completionItems?: CompletionItem[];
  maxCompletions?: number;
  pointsPerCompletion?: number;
  breathPrayer?: BreathPrayerPair[];
  scripture?: ScriptureBlock[];
  prompts?: ProgramPrompt[];
  points: number;
};

export type CompletionItem = {
  id: string;
  label: string;
};

export type BreathPrayerPair = {
  inhale: string;
  exhale: string;
};

export type ScriptureBlock = {
  reference: string;
  text: string;
};

export type ProgramPrompt = {
  id: string;
  label: string;
};

export type ProgramImportPreview = {
  program: Program;
  warnings: string[];
  contentHash: string;
};
