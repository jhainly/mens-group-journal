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
  type JournalDayState,
  type UserGroupSummary
} from "@/lib/services/dataClient";
import type { Program, ProgramDay } from "@/types/program";

type VerificationFailure = {
  answerId?: string;
  answerKey: string;
  encryptedRecordReturned: boolean;
  reason: "delete-not-applied" | "decrypt-failed" | "missing-record" | "value-mismatch";
};

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
  const [isJournalLoaded, setIsJournalLoaded] = useState(false);

  const router = useRouter();
  const hasLoadedRef = useRef(false);
  const hasUserChangedRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  const completedSectionIdsRef = useRef<string[]>([]);
  const dirtyAnswerKeysRef = useRef<Set<string>>(new Set());
  const isSavingRef = useRef(false);
  const saveAgainRef = useRef(false);
  const queuedApprovedReplacementKeysRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<(approvedKeys?: string[]) => Promise<void>>(async () => undefined);

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
    setIsJournalLoaded(false);
    setSaveStatus("idle");
    setNeedsReauth(false);
    setAnswers({});
    answersRef.current = {};
    completedSectionIdsRef.current = [];
    dirtyAnswerKeysRef.current.clear();
    queuedApprovedReplacementKeysRef.current.clear();
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
    setIsJournalLoaded(false);

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
        setIsJournalLoaded(false);
        return;
      }

      setAnswers(result.data.answers);
      answersRef.current = result.data.answers;
      completedSectionIdsRef.current = result.data.completedSectionIds;
      dirtyAnswerKeysRef.current.clear();
      queuedApprovedReplacementKeysRef.current.clear();
      setCompletedSectionIds(result.data.completedSectionIds);
      setNeedsReauth(result.data.needsReauth);
      setFailedAnswerKeys(result.data.failedAnswerKeys);
      setApprovedReplacementKeys([]);
      setJournalStatus(result.data.needsReauth ? "" : (result.data.warning ?? ""));
      setIsJournalLoaded(true);
      hasUserChangedRef.current = false;
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

    if (!isJournalLoaded) {
      setSaveStatus("error");
      setSaveError("Saved progress is still loading. Wait for it to finish before saving reflections.");
      return;
    }

    if (isSavingRef.current) {
      saveAgainRef.current = true;
      for (const answerKey of approvedKeys) {
        queuedApprovedReplacementKeysRef.current.add(answerKey);
      }
      return;
    }

    const answersSnapshot = answersRef.current;
    const dirtyAnswerKeys = Array.from(dirtyAnswerKeysRef.current);
    const keysToSave = Array.from(new Set([...dirtyAnswerKeys, ...approvedKeys]));
    const answerPayload = getAnswerPayload(day, answersSnapshot, keysToSave);
    const missingAnswerKeys = keysToSave.filter((answerKey) => !(answerKey in answerPayload));
    if (missingAnswerKeys.length > 0) {
      setSaveStatus("error");
      setSaveError("Some changed reflections could not be matched to this program day. Reload the page before saving.");
      return;
    }

    const hasReflections = Object.values(answerPayload).some((answer) => answer.value.trim());
    if (hasReflections && !canEncryptJournalAnswers()) {
      setSaveStatus("error");
      setSaveError(getJournalEncryptionRequirementMessage());
      return;
    }

    setSaveStatus("saving");
    isSavingRef.current = true;
    const approvedReplacementSet = new Set(approvedKeys);
    const blockedAnswerKeys = failedAnswerKeys.filter((answerKey) => !approvedReplacementSet.has(answerKey));

    const result = await saveJournalDay({
      groupId: activeGroup.groupId,
      program,
      weekNumber,
      dayNumber: day.dayNumber,
      completedSectionIds: completedSectionIdsRef.current,
      blockedAnswerKeys,
      answers: answerPayload
    });

    isSavingRef.current = false;

    if (!result.ok) {
      setSaveStatus("error");
      setSaveError(result.error);
      if (saveAgainRef.current) {
        runQueuedSave();
      }
      return;
    }

    const verified = await verifySavedAnswers(answerPayload, blockedAnswerKeys);
    if (!verified.ok) {
      setSaveStatus("error");
      setSaveError(verified.error);
      if (saveAgainRef.current) {
        runQueuedSave();
      }
      return;
    }

    for (const [answerKey, savedAnswer] of Object.entries(answerPayload)) {
      if ((answersRef.current[answerKey] ?? "") === savedAnswer.value) {
        dirtyAnswerKeysRef.current.delete(answerKey);
      }
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
      if (saveAgainRef.current) {
        runQueuedSave();
      }
      return;
    }

    setSaveStatus("saved");

    if (saveAgainRef.current) {
      runQueuedSave();
    }
  }

  function runQueuedSave() {
    const queuedApprovedKeys = Array.from(queuedApprovedReplacementKeysRef.current);
    queuedApprovedReplacementKeysRef.current.clear();
    saveAgainRef.current = false;
    void saveRef.current(queuedApprovedKeys);
  }

  async function verifySavedAnswers(
    answerPayload: Record<string, { promptId: string; sectionId: string; value: string }>,
    blockedAnswerKeys: string[]
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!activeGroup || !program || !day) {
      return { ok: true };
    }

    const expectedAnswers = Object.entries(answerPayload).filter(([answerKey]) => !blockedAnswerKeys.includes(answerKey));
    if (expectedAnswers.length === 0) {
      return { ok: true };
    }

    const waitTimesMs = [0, 300, 900];
    let failures: VerificationFailure[] = [];
    let lastLoaded: JournalDayState | null = null;

    for (const waitTimeMs of waitTimesMs) {
      if (waitTimeMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
      }

      const loaded = await loadJournalDay({
        groupId: activeGroup.groupId,
        program,
        weekNumber,
        dayNumber: day.dayNumber
      });

      if (!loaded.ok) {
        return { ok: false, error: loaded.error };
      }

      lastLoaded = loaded.data;
      failures = expectedAnswers.flatMap<VerificationFailure>(([answerKey, answer]) => {
        const encryptedRecordReturned = loaded.data.encryptedAnswerKeys.includes(answerKey);
        const decryptFailed = loaded.data.failedAnswerKeys.includes(answerKey);
        const loadedValue = loaded.data.answers[answerKey] ?? "";
        const answerId = loaded.data.expectedAnswerIdsByKey[answerKey];

        if (!answer.value.trim()) {
          if (encryptedRecordReturned || decryptFailed || loadedValue) {
            return [{ answerId, answerKey, encryptedRecordReturned, reason: "delete-not-applied" as const }];
          }

          return [];
        }

        if (!encryptedRecordReturned) {
          return [{ answerId, answerKey, encryptedRecordReturned, reason: "missing-record" as const }];
        }

        if (decryptFailed) {
          return [{ answerId, answerKey, encryptedRecordReturned, reason: "decrypt-failed" as const }];
        }

        if (loadedValue !== answer.value) {
          return [{ answerId, answerKey, encryptedRecordReturned, reason: "value-mismatch" as const }];
        }

        return [];
      });

      if (failures.length === 0) {
        return { ok: true };
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("Journal save verification failed", {
        dayNumber: day.dayNumber,
        decryptedAnswerKeys: Object.keys(lastLoaded?.answers ?? {}),
        encryptedAnswerCount: lastLoaded?.encryptedAnswerCount ?? 0,
        encryptedAnswerKeys: lastLoaded?.encryptedAnswerKeys ?? [],
        failedAnswerKeys: lastLoaded?.failedAnswerKeys ?? [],
        failures,
        groupId: activeGroup.groupId,
        programId: program.program.id,
        weekNumber
      });
    }

    const reasons = Array.from(new Set(failures.map((failure) => failure.reason))).join(", ");

    return {
      ok: false,
      error: `The reflection save could not be verified${reasons ? ` (${reasons})` : ""}. Your text is still on this page. Use Retry save before leaving.`
    };
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
  }, [answers, completedSectionIds]);

  function toggleSection(sectionId: string) {
    hasUserChangedRef.current = true;
    setSaveStatus("idle");
    setSaveError("");
    const nextCompletedSectionIds = completedSectionIdsRef.current.includes(sectionId)
      ? completedSectionIdsRef.current.filter((id) => id !== sectionId)
      : [...completedSectionIdsRef.current, sectionId];
    completedSectionIdsRef.current = nextCompletedSectionIds;
    setCompletedSectionIds(nextCompletedSectionIds);
  }

  function updateAnswer(promptId: string, sectionId: string, value: string) {
    hasUserChangedRef.current = true;
    setSaveStatus("idle");
    setSaveError("");
    dirtyAnswerKeysRef.current.add(promptId);
    answersRef.current = { ...answersRef.current, [promptId]: value };
    setAnswers((current) => ({ ...current, [promptId]: value }));

    if (value.trim()) {
      if (!completedSectionIdsRef.current.includes(sectionId)) {
        const nextCompletedSectionIds = [...completedSectionIdsRef.current, sectionId];
        completedSectionIdsRef.current = nextCompletedSectionIds;
        setCompletedSectionIds(nextCompletedSectionIds);
      }
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

  function getAnswerPayload(
    currentDay: ProgramDay,
    currentAnswers: Record<string, string>,
    answerKeys: string[]
  ): Record<string, { promptId: string; sectionId: string; value: string }> {
    const keysToSave = new Set(answerKeys);

    return Object.fromEntries(
      currentDay.sections.flatMap((section) => {
        const prompts = section.prompts ?? [];

        if (prompts.length > 0) {
          const promptStorageIds = journalPromptStorageIds(prompts);
          return promptStorageIds.flatMap((promptStorageId) => {
            const answerKey = journalPromptAnswerKey(section.id, promptStorageId);

            if (!keysToSave.has(answerKey)) {
              return [];
            }

            return [
              [
                answerKey,
                {
                  promptId: promptStorageId,
                  sectionId: section.id,
                  value: currentAnswers[answerKey] ?? ""
                }
              ]
            ];
          });
        }

        const reflectionId = journalSectionReflectionKey(section.id);

        if (!keysToSave.has(reflectionId)) {
          return [];
        }

        return [[reflectionId, { promptId: "reflection", sectionId: section.id, value: currentAnswers[reflectionId] ?? "" }]];
      })
    );
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
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <p className="muted" aria-live="polite" style={{ whiteSpace: "nowrap" }}>
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? saveError : ""}
            </p>
            {saveStatus === "error" ? (
              <button className="button secondary" onClick={() => void saveRef.current()} type="button">
                Retry save
              </button>
            ) : null}
          </div>
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

      {isJournalLoaded && !needsReauth && day?.sections.map((section) => (
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
                          onBlur={() => void saveRef.current()}
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
                          onBlur={() => void saveRef.current()}
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
