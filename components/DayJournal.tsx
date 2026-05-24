"use client";

import { useState } from "react";
import Link from "next/link";
import { canEncryptJournalAnswers, getJournalEncryptionRequirementMessage } from "@/lib/encryption";
import { formatPoints } from "@/lib/format";
import { getProgramDayLabel } from "@/lib/programDays";
import { saveJournalDay } from "@/lib/services/dataClient";
import type { Program } from "@/types/program";
import type { ProgramDay } from "@/types/program";

export function DayJournal({
  weekNumber,
  day,
  program,
  groupId
}: {
  weekNumber: number;
  day: ProgramDay;
  program: Program;
  groupId: string;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completedSectionIds, setCompletedSectionIds] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [message, setMessage] = useState("");

  async function save() {
    setMessage("");
    const hasReflections = Object.values(answers).some((answer) => answer.trim());

    if (hasReflections && !canEncryptJournalAnswers()) {
      setMessage(getJournalEncryptionRequirementMessage());
      return;
    }

    const result = await saveJournalDay({
      groupId,
      program,
      weekNumber,
      dayNumber: day.dayNumber,
      completedSectionIds,
      answers: Object.fromEntries(
        day.sections.flatMap((section) =>
          (section.prompts ?? []).map((prompt) => [
            prompt.id,
            {
              sectionId: section.id,
              value: answers[prompt.id] ?? ""
            }
          ])
        )
      )
    });

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setSavedCount(Object.values(answers).filter((answer) => answer.trim()).length);
    setMessage("Saved.");
  }

  function toggleSection(sectionId: string) {
    setCompletedSectionIds((current) =>
      current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId]
    );
  }

  function updateAnswer(promptId: string, sectionId: string, value: string) {
    setAnswers((current) => ({ ...current, [promptId]: value }));

    if (value.trim()) {
      setCompletedSectionIds((current) => (current.includes(sectionId) ? current : [...current, sectionId]));
    }
  }

  function resizeTextarea(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  return (
    <div className="stack">
      <div>
        <Link className="button" href={`/dashboard?week=${weekNumber}`}>
          Back to week {weekNumber}
        </Link>
      </div>

      <section className="panel stack">
        <div>
          <p className="eyebrow">Week {weekNumber}</p>
          <h1>{getProgramDayLabel(day.dayNumber)}: {day.title}</h1>
          <p>Your reflections are private and stay connected to your account.</p>
        </div>
      </section>

      {day.sections.map((section) => (
        <section className="panel" key={section.id}>
          <div className="section-layout">
            <label className="section-check" aria-label={`Mark ${section.title} complete`}>
              <input
                checked={completedSectionIds.includes(section.id)}
                onChange={() => toggleSection(section.id)}
                type="checkbox"
              />
            </label>

            <div className="section-content">
              <div>
                <p className="eyebrow">{formatPoints(section.points)}</p>
                <h2>{section.title}</h2>
              </div>
              {section.body ? <p>{section.body}</p> : null}
              {section.scripture?.map((scripture) => (
                <blockquote className="scripture" key={scripture.reference}>
                  <strong>{scripture.reference}</strong>
                  <p>{scripture.text}</p>
                </blockquote>
              ))}
              {section.prompts?.map((prompt) => (
                <label className="field" key={prompt.id}>
                  <span>{prompt.label}</span>
                  <textarea
                    className="journal-textarea"
                    value={answers[prompt.id] ?? ""}
                    onChange={(event) => {
                      updateAnswer(prompt.id, section.id, event.target.value);
                      resizeTextarea(event.currentTarget);
                    }}
                    placeholder="Optional reflection"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
      ))}

      <div className="row">
        <button className="button" onClick={save} type="button">
          Save reflection
        </button>
        <span>{savedCount > 0 ? `${savedCount} reflection saved.` : "No saved reflection yet."}</span>
      </div>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
