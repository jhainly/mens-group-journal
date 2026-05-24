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
  title: string;
  sections: ProgramSection[];
};

export type ProgramSection = {
  id: string;
  title: string;
  body?: string;
  scripture?: ScriptureBlock[];
  prompts?: ProgramPrompt[];
  points: number;
};

export type ScriptureBlock = {
  reference: string;
  text: string;
};

export type ProgramPrompt = {
  id: string;
  label: string;
  optional?: boolean;
};

export type ProgramImportPreview = {
  program: Program;
  warnings: string[];
  contentHash: string;
};

export type PublishedProgramSnapshot = Program & {
  contentHash: string;
  publishedAt: string;
  publishedByUserId: string;
};
