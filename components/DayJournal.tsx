"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import { canEncryptJournalAnswers, getJournalEncryptionRequirementMessage } from "@/lib/encryption";
import { configureAmplify } from "@/lib/amplifyClient";
import { clearJournalEncryptionSecret } from "@/lib/journalKey";
import {
  journalPromptAnswerKey,
  journalPromptStorageIds,
  journalSectionReflectionKey,
  resolveJournalAnswer
} from "@/lib/journalAnswerKeys";
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
  const [needsReauth, setNeedsReauth] = useState(false);
  const [failedAnswerKeys, setFailedAnswerKeys] = useState<string[]>([]);
  const [approvedReplacementKeys, setApprovedReplacementKeys] = useState<string[]>([]);
  const [groupStatus, setGroupStatus] = useState("Loading group...");
  const [programStatus, setProgramStatus] = useState("Loading program...");
  const [journalStatus, setJournalStatus] = useState("");

  const router = useRouter();
  const hasLoadedRef = useRef(false);
  const hasUserChangedRef = useRef(false);
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
    hasUserChangedRef.current = false;
    setProgram(null);
    setDay(null);
    setProgramStatus("Loading program...");
    setJournalStatus("");
    setSaveStatus("idle");
    setNeedsReauth(false);
    setAnswers({});
    setCompletedSectionIds([]);
    setFailedAnswerKeys([]);
    setApprovedReplacementKeys([]);

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

      const completedFromAnswers = getCompletedSectionIdsFromAnswers(day, result.data.answers);
      const mergedCompletedSectionIds = Array.from(
        new Set([...result.data.completedSectionIds, ...completedFromAnswers])
      );
      const repairedMissingCompletions = mergedCompletedSectionIds.length > result.data.completedSectionIds.length;

      setAnswers(result.data.answers);
      setCompletedSectionIds(mergedCompletedSectionIds);
      setNeedsReauth(result.data.needsReauth);
      setFailedAnswerKeys(result.data.failedAnswerKeys);
      setApprovedReplacementKeys([]);
      setJournalStatus(result.data.needsReauth ? "" : (result.data.warning ?? ""));
      hasUserChangedRef.current = repairedMissingCompletions;
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

  async function save(approvedKeys = approvedReplacementKeys) {
    if (!activeGroup || !program || !day) return;

    const hasReflections = Object.values(answers).some((answer) => answer.trim());
    if (hasReflections && !canEncryptJournalAnswers()) {
      setSaveStatus("error");
      setSaveError(getJournalEncryptionRequirementMessage());
      return;
    }

    setSaveStatus("saving");
    const approvedReplacementSet = new Set(approvedKeys);
    const blockedAnswerKeys = failedAnswerKeys.filter((answerKey) => !approvedReplacementSet.has(answerKey));

    const result = await saveJournalDay({
      groupId: activeGroup.groupId,
      program,
      weekNumber,
      dayNumber: day.dayNumber,
      completedSectionIds,
      blockedAnswerKeys,
      answers: Object.fromEntries(
        day.sections.flatMap((section) => {
          const prompts = section.prompts ?? [];
          if (prompts.length > 0) {
            const promptStorageIds = journalPromptStorageIds(prompts);
            // UI state keys include the section id so repeated prompt ids in imported YAML cannot collide.
            return prompts.map((prompt, promptIndex) => {
              const promptStorageId = promptStorageIds[promptIndex];
              return [
                journalPromptAnswerKey(section.id, promptStorageId),
                {
                  promptId: promptStorageId,
                  sectionId: section.id,
                  value: resolveJournalAnswer(answers, section.id, promptStorageId)
                }
              ];
            });
          }
          const reflectionId = journalSectionReflectionKey(section.id);
          return [[reflectionId, { promptId: "reflection", sectionId: section.id, value: answers[reflectionId] ?? "" }]];
        })
      )
    });

    if (!result.ok) {
      setSaveStatus("error");
      setSaveError(result.error);
      return;
    }

    if (approvedKeys.length > 0) {
      setFailedAnswerKeys((current) => current.filter((answerKey) => !approvedReplacementSet.has(answerKey)));
      setApprovedReplacementKeys((current) => current.filter((answerKey) => !approvedReplacementSet.has(answerKey)));
    }

    if (blockedAnswerKeys.length > 0) {
      setSaveStatus("error");
      setSaveError(
        `${blockedAnswerKeys.length} saved reflection${blockedAnswerKeys.length === 1 ? "" : "s"} could not be decrypted. Replace the unreadable field before it can be saved over.`
      );
      return;
    }

    setSaveStatus("saved");
  }

  // Keep saveRef pointing at the latest save closure
  useEffect(() => {
    saveRef.current = save;
  });

  // Auto-save: debounce 1.5s after any change, skip during initial load and after load before user changes
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (!hasUserChangedRef.current) return;

    setSaveStatus("idle");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void saveRef.current(), 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, completedSectionIds]);

  function toggleSection(sectionId: string) {
    hasUserChangedRef.current = true;
    setCompletedSectionIds((current) =>
      current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId]
    );
  }

  function updateAnswer(promptId: string, sectionId: string, value: string) {
    hasUserChangedRef.current = true;
    setAnswers((current) => ({ ...current, [promptId]: value }));

    if (value.trim()) {
      setCompletedSectionIds((current) => (current.includes(sectionId) ? current : [...current, sectionId]));
    }
  }

  function replaceUnreadableAnswer(answerKey: string) {
    if (!answers[answerKey]?.trim()) {
      setSaveStatus("error");
      setSaveError("Type a replacement reflection before replacing unreadable saved text.");
      return;
    }

    const nextApprovedKeys = Array.from(new Set([...approvedReplacementKeys, answerKey]));
    setApprovedReplacementKeys(nextApprovedKeys);
    hasUserChangedRef.current = true;
    void save(nextApprovedKeys);
  }

  function resizeTextarea(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  function getCompletedSectionIdsFromAnswers(currentDay: ProgramDay, currentAnswers: Record<string, string>): string[] {
    return currentDay.sections
      .filter((section) => {
        const prompts = section.prompts ?? [];

        if (prompts.length > 0) {
          const promptStorageIds = journalPromptStorageIds(prompts);
          return promptStorageIds.some((promptStorageId) =>
            resolveJournalAnswer(currentAnswers, section.id, promptStorageId).trim()
          );
        }

        return Boolean(currentAnswers[journalSectionReflectionKey(section.id)]?.trim());
      })
      .map((section) => section.id);
  }

  async function handleReauth() {
    await configureAmplify();
    await signOut();
    clearJournalEncryptionSecret();
    router.push("/auth");
    router.refresh();
  }


  const dayMaxPoints = day?.sections.reduce((sum, s) => sum + Math.max(0, s.points), 0) ?? 0;
  const dayEarnedPoints = day?.sections
    .filter((s) => completedSectionIds.includes(s.id))
    .reduce((sum, s) => sum + Math.max(0, s.points), 0) ?? 0;
  const dayProgressPct = dayMaxPoints > 0 ? Math.round((dayEarnedPoints / dayMaxPoints) * 100) : 0;

  return (
    <div className="stack">
      <div>
        <Link className="button" href={`/dashboard?week=${weekNumber}`}>
          Back to week {weekNumber}
        </Link>
      </div>

      <section className="panel stack">
        <div className="row">
          <h1>{day ? `${getProgramDayLabel(day.dayNumber)}: ${day.title}` : "Program day"}</h1>
          <p className="muted" aria-live="polite" style={{ whiteSpace: "nowrap" }}>
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? saveError : ""}
          </p>
        </div>
        {day ? (
          <div className="day-progress">
            <div className="day-progress-track">
              <div className="day-progress-fill" style={{ width: `${dayProgressPct}%` }} />
            </div>
            <span className="day-progress-label">{dayEarnedPoints}/{dayMaxPoints} pts</span>
          </div>
        ) : null}
        {groupStatus ? <p className="muted">{groupStatus}</p> : null}
        {programStatus ? <p className="muted">{programStatus}</p> : null}
        {journalStatus ? <p className="muted">{journalStatus}</p> : null}
      </section>

      {needsReauth ? (
        <section className="panel stack">
          <p>Your saved reflections are encrypted and can&apos;t be shown without signing in again.</p>
          <div>
            <button className="button" onClick={() => void handleReauth()} type="button">
              Sign out and sign back in
            </button>
          </div>
        </section>
      ) : null}

      {!needsReauth && day?.sections.map((section) => (
        <section className={`panel${completedSectionIds.includes(section.id) ? " section-complete" : ""}`} key={section.id}>
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
              {!needsReauth && section.prompts && section.prompts.length > 0
                  ? (() => {
                    const promptStorageIds = journalPromptStorageIds(section.prompts);
                    return section.prompts.map((prompt, promptIndex) => {
                      const promptStorageId = promptStorageIds[promptIndex];
                      const answerKey = journalPromptAnswerKey(section.id, promptStorageId);
                      const decryptFailed = failedAnswerKeys.includes(answerKey);
                      const replacementApproved = approvedReplacementKeys.includes(answerKey);
                      return (
                        <div className="field" key={answerKey}>
                          <span>{prompt.label}</span>
                          {decryptFailed ? (
                            <span className="warning">
                              A saved reflection exists here, but this session cannot decrypt it.
                            </span>
                          ) : null}
                          <textarea
                            className="journal-textarea"
                            value={resolveJournalAnswer(answers, section.id, promptStorageId)}
                            onChange={(event) => {
                              updateAnswer(answerKey, section.id, event.target.value);
                              resizeTextarea(event.currentTarget);
                            }}
                            placeholder={decryptFailed ? "Type replacement text here" : "Optional reflection"}
                          />
                          {decryptFailed && !replacementApproved ? (
                            <button
                              className="button secondary"
                              onClick={() => replaceUnreadableAnswer(answerKey)}
                              type="button"
                            >
                              Replace unreadable reflection
                            </button>
                          ) : null}
                        </div>
                      );
                    });
                  })()
                : !needsReauth ? (() => {
                    const reflectionId = journalSectionReflectionKey(section.id);
                    const decryptFailed = failedAnswerKeys.includes(reflectionId);
                    const replacementApproved = approvedReplacementKeys.includes(reflectionId);
                    return (
                      <div className="field" key={reflectionId}>
                        {decryptFailed ? (
                          <span className="warning">
                            A saved reflection exists here, but this session cannot decrypt it.
                          </span>
                        ) : null}
                        <textarea
                          className="journal-textarea"
                          value={answers[reflectionId] ?? ""}
                          onChange={(event) => {
                            updateAnswer(reflectionId, section.id, event.target.value);
                            resizeTextarea(event.currentTarget);
                          }}
                          placeholder={decryptFailed ? "Type replacement text here" : "Optional reflection"}
                        />
                        {decryptFailed && !replacementApproved ? (
                          <button
                            className="button secondary"
                            onClick={() => replaceUnreadableAnswer(reflectionId)}
                            type="button"
                          >
                            Replace unreadable reflection
                          </button>
                        ) : null}
                      </div>
                    );
                  })() : null}
            </div>
          </div>
        </section>
      ))}

    </div>
  );
}
