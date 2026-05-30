import yaml from "js-yaml";
import { z } from "zod";
import type { Program, ProgramImportPreview } from "@/types/program";

const promptSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  optional: z.boolean().optional()
});

const scriptureSchema = z.object({
  reference: z.string().min(1),
  text: z.string().min(1)
});

const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  scripture: z.array(scriptureSchema).optional(),
  prompts: z.array(promptSchema).optional(),
  points: z.number().int().nonnegative()
});

const daySchema = z.object({
  dayNumber: z.number().int().positive(),
  title: z.string().min(1),
  sections: z.array(sectionSchema).min(1)
});

const weekSchema = z.object({
  weekNumber: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().optional(),
  days: z.array(daySchema).min(1)
});

export const programSchema = z.object({
  program: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    version: z.string().min(1),
    description: z.string().optional()
  }),
  weeks: z.array(weekSchema).min(1)
});

export type ProgramValidationResult =
  | { ok: true; preview: ProgramImportPreview }
  | { ok: false; errors: string[] };

export async function validateProgramYaml(source: string): Promise<ProgramValidationResult> {
  let parsed: unknown;

  try {
    parsed = yaml.load(source);
  } catch (error) {
    return { ok: false, errors: [`Invalid YAML: ${getErrorMessage(error)}`] };
  }

  const result = programSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    };
  }

  const warnings = validateProgramSemantics(result.data);
  const contentHash = await hashProgram(result.data);

  return {
    ok: true,
    preview: {
      program: result.data,
      warnings,
      contentHash
    }
  };
}

function validateProgramSemantics(program: Program): string[] {
  const warnings: string[] = [];
  const weekNumbers = new Set<number>();

  for (const week of program.weeks) {
    if (weekNumbers.has(week.weekNumber)) {
      warnings.push(`Duplicate weekNumber ${week.weekNumber}.`);
    }
    weekNumbers.add(week.weekNumber);

    const dayNumbers = new Set<number>();
    for (const day of week.days) {
      if (dayNumbers.has(day.dayNumber)) {
        warnings.push(`Duplicate dayNumber ${day.dayNumber} in week ${week.weekNumber}.`);
      }
      dayNumbers.add(day.dayNumber);

      const sectionIds = new Set<string>();
      for (const section of day.sections) {
        if (sectionIds.has(section.id)) {
          warnings.push(`Duplicate section id "${section.id}" in week ${week.weekNumber}, day ${day.dayNumber}.`);
        }
        sectionIds.add(section.id);
      }
    }
  }

  return warnings;
}

export async function hashProgram(program: Program): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(program));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toBase64Url(new Uint8Array(digest));
}

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
