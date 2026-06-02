"use client";

import { useEffect, useRef, useState } from "react";
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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [groupStatus, setGroupStatus] = useState("Loading group...");
  const [programStatus, setProgramStatus] = useState("Loading program...");
  const [journalStatus, setJournalStatus] = useState("");

  const hasLoadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => undefined);

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

    hasLoadedRef.current = false;
    setProgram(null);
    setDay(null);
    setProgramStatus("Loading program...");
    setJournalStatus("");
    setSaveStatus("idle");
    setAnswers({});
    setCompletedSectionIds([]);

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
      setJournalStatus(result.data.warning ?? "");
      hasLoadedRef.current = true;
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
    if (!activeGroup || !program || !day) return;

    const hasReflections = Object.values(answers).some((answer) => answer.trim());
    if (hasReflections && !canEncryptJournalAnswers()) {
      setSaveStatus("error");
      setSaveError(getJournalEncryptionRequirementMessage());
      return;
    }

    setSaveStatus("saving");

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
      setSaveStatus("error");
      setSaveError(result.error);
      return;
    }

    setSaveStatus("saved");
  }

  // Keep saveRef pointing at the latest save closure
  useEffect(() => {
    saveRef.current = save;
  });

  // Auto-save: debounce 1.5s after any change, skip during initial load
  useEffect(() => {
    if (!hasLoadedRef.current) return;

    setSaveStatus("idle");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void saveRef.current(), 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, completedSectionIds]);

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
          {day ? (
            <p className="muted">
              {completedSectionIds.length} of {day.sections.length} sections complete
            </p>
          ) : null}
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

      <p className="muted" aria-live="polite">
        {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? saveError : ""}
      </p>
    </div>
  );
}
