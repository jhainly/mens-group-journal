"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { canEncryptJournalAnswers, getJournalEncryptionRequirementMessage } from "@/lib/encryption";
import { formatPoints } from "@/lib/format";
import { resolveSelectedGroup, setSelectedGroupId } from "@/lib/groupSelection";
import { getProgramDayLabel } from "@/lib/programDays";
import {
  listCurrentUserGroups,
  loadActiveProgramForGroup,
  loadJournalDay,
  saveJournalDay,
  type UserGroupSummary
} from "@/lib/services/dataClient";
import type { Program, ProgramDay } from "@/types/program";

function sectionReflectionId(sectionId: string): string {
  return `${sectionId}:reflection`;
}

export function DayJournal({
  weekNumber,
  dayNumber
}: {
  weekNumber: number;
  dayNumber: number;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completedSectionIds, setCompletedSectionIds] = useState<string[]>([]);
  const [activeGroup, setActiveGroup] = useState<UserGroupSummary | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [day, setDay] = useState<ProgramDay | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [groupStatus, setGroupStatus] = useState("Loading group...");
  const [programStatus, setProgramStatus] = useState("Loading program...");
  const [journalStatus, setJournalStatus] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    void listCurrentUserGroups().then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setGroupStatus(result.error);
        return;
      }

      const selectedGroup = resolveSelectedGroup(result.data);
      setActiveGroup(selectedGroup);

      if (selectedGroup) {
        setSelectedGroupId(selectedGroup.groupId);
        setGroupStatus("");
      } else {
        setGroupStatus("Join a group before saving progress.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!activeGroup) {
      setProgram(null);
      setDay(null);
      setProgramStatus("");
      return () => {
        cancelled = true;
      };
    }

    setProgram(null);
    setDay(null);
    setProgramStatus("Loading program...");
    setJournalStatus("");
    setAnswers({});
    setCompletedSectionIds([]);
    setSavedCount(0);

    void loadActiveProgramForGroup(activeGroup.groupId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setProgramStatus(result.error);
        return;
      }

      const activeProgram = result.data.program;
      const activeDay =
        activeProgram.weeks
          .find((week) => week.weekNumber === weekNumber)
          ?.days.find((candidate) => candidate.dayNumber === dayNumber) ?? null;

      setProgram(activeProgram);
      setDay(activeDay);
      setProgramStatus(activeDay ? "" : "That day is not available in the active program.");
    });

    return () => {
      cancelled = true;
    };
  }, [activeGroup, dayNumber, weekNumber]);

  useEffect(() => {
    let cancelled = false;

    if (!activeGroup || !program || !day) {
      return () => {
        cancelled = true;
      };
    }

    setJournalStatus("Loading saved progress...");

    void loadJournalDay({
      groupId: activeGroup.groupId,
      program,
      weekNumber,
      dayNumber: day.dayNumber
    }).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setJournalStatus(result.error);
        return;
      }

      setAnswers(result.data.answers);
      setCompletedSectionIds(result.data.completedSectionIds);
      setSavedCount(Object.values(result.data.answers).filter((answer) => answer.trim()).length);
      setJournalStatus(result.data.warning ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [activeGroup, day, program, weekNumber]);

  useEffect(() => {
    for (const textarea of document.querySelectorAll<HTMLTextAreaElement>(".journal-textarea")) {
      resizeTextarea(textarea);
    }
  }, [answers]);

  async function save() {
    if (isSaving) return;
    setMessage("");
    setIsSaving(true);

    try {
      if (!activeGroup) {
        setMessage("Join a group before saving progress.");
        return;
      }

      if (!program || !day) {
        setMessage("Load an active program before saving progress.");
        return;
      }

      const hasReflections = Object.values(answers).some((answer) => answer.trim());

      if (hasReflections && !canEncryptJournalAnswers()) {
        setMessage(getJournalEncryptionRequirementMessage());
        return;
      }

      const result = await saveJournalDay({
        groupId: activeGroup.groupId,
        program,
        weekNumber,
        dayNumber: day.dayNumber,
        completedSectionIds,
        answers: Object.fromEntries(
          day.sections.flatMap((section) => {
            const prompts = section.prompts ?? [];
            if (prompts.length > 0) {
              return prompts.map((prompt) => [
                prompt.id,
                { sectionId: section.id, value: answers[prompt.id] ?? "" }
              ]);
            }
            const reflectionId = sectionReflectionId(section.id);
            return [[reflectionId, { sectionId: section.id, value: answers[reflectionId] ?? "" }]];
          })
        )
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setSavedCount(Object.values(answers).filter((answer) => answer.trim()).length);
      setMessage("Saved.");
    } finally {
      setIsSaving(false);
    }
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
          <h1>{day ? `${getProgramDayLabel(day.dayNumber)}: ${day.title}` : "Program day"}</h1>
          <p>
            Your reflections are private and stay connected to your account
            {activeGroup ? ` in ${activeGroup.name}.` : "."}
          </p>
        </div>
        {groupStatus ? <p className="muted">{groupStatus}</p> : null}
        {programStatus ? <p className="muted">{programStatus}</p> : null}
        {journalStatus ? <p className="muted">{journalStatus}</p> : null}
      </section>

      {day?.sections.map((section) => (
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
              {section.prompts && section.prompts.length > 0
                ? section.prompts.map((prompt) => (
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
                  ))
                : (() => {
                    const reflectionId = sectionReflectionId(section.id);
                    return (
                      <label className="field" key={reflectionId}>
                        <textarea
                          className="journal-textarea"
                          value={answers[reflectionId] ?? ""}
                          onChange={(event) => {
                            updateAnswer(reflectionId, section.id, event.target.value);
                            resizeTextarea(event.currentTarget);
                          }}
                          placeholder="Optional reflection"
                        />
                      </label>
                    );
                  })()}
            </div>
          </div>
        </section>
      ))}

      <div className="row">
        <button className="button" disabled={!activeGroup || !program || !day || isSaving} onClick={save} type="button">
          {isSaving ? "Saving..." : "Save"}
        </button>
        <span>{savedCount > 0 ? `${savedCount} reflection saved.` : "No saved reflection yet."}</span>
      </div>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
