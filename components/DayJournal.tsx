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
import { getProgramDayDisplayName } from "@/lib/programDays";
import {
  listCurrentUserGroups,
  loadActiveProgramForGroup,
  loadJournalDay,
  saveJournalDay,
  type JournalDayState,
  type UserGroupSummary
} from "@/lib/services/dataClient";
import type { Program, ProgramDay, ProgramSection } from "@/types/program";

type VerificationFailure = {
  answerId?: string;
  answerKey: string;
  encryptedRecordReturned: boolean;
  reason: "delete-not-applied" | "decrypt-failed" | "missing-record" | "value-mismatch";
};
type ProgressVerificationFailure = {
  expectedPointsEarned: number;
  progressId?: string;
  actualPointsEarned: number;
  sectionId: string;
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
  const [sectionPointsEarned, setSectionPointsEarned] = useState<Record<string, number>>({});
  const [sectionCompletedItemIds, setSectionCompletedItemIds] = useState<Record<string, string[]>>({});
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
  const sectionPointsEarnedRef = useRef<Record<string, number>>({});
  const sectionCompletedItemIdsRef = useRef<Record<string, string[]>>({});
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
    sectionPointsEarnedRef.current = {};
    sectionCompletedItemIdsRef.current = {};
    dirtyAnswerKeysRef.current.clear();
    queuedApprovedReplacementKeysRef.current.clear();
    setCompletedSectionIds([]);
    setSectionPointsEarned({});
    setSectionCompletedItemIds({});
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
      sectionPointsEarnedRef.current = result.data.sectionPointsEarned;
      sectionCompletedItemIdsRef.current = result.data.sectionCompletedItemIds;
      dirtyAnswerKeysRef.current.clear();
      queuedApprovedReplacementKeysRef.current.clear();
      setCompletedSectionIds(result.data.completedSectionIds);
      setSectionPointsEarned(result.data.sectionPointsEarned);
      setSectionCompletedItemIds(result.data.sectionCompletedItemIds);
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

  const isReadOnly = Boolean(activeGroup?.isArchived);

  async function save(approvedKeys = approvedReplacementKeys) {
    if (!activeGroup || !program || !day) return;

    if (isReadOnly) {
      return;
    }

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
      sectionPointsEarned: sectionPointsEarnedRef.current,
      sectionCompletedItemIds: sectionCompletedItemIdsRef.current,
      blockedAnswerKeys,
      answers: answerPayload
    });

    if (!result.ok) {
      isSavingRef.current = false;
      setSaveStatus("error");
      setSaveError(result.error);
      if (saveAgainRef.current) {
        runQueuedSave();
      }
      return;
    }

    const progressVerified = await verifySavedProgress();
    if (!progressVerified.ok) {
      isSavingRef.current = false;
      setSaveStatus("error");
      setSaveError(progressVerified.error);
      if (saveAgainRef.current) {
        runQueuedSave();
      }
      return;
    }

    const verified = await verifySavedAnswers(answerPayload, blockedAnswerKeys);
    if (!verified.ok) {
      isSavingRef.current = false;
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
      isSavingRef.current = false;
      if (saveAgainRef.current) {
        runQueuedSave();
      }
      return;
    }

    isSavingRef.current = false;
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

  async function verifySavedProgress(): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!activeGroup || !program || !day) {
      return { ok: true };
    }

    const expectedPointsBySectionId = sectionPointsEarnedRef.current;
    const waitTimesMs = [0, 300, 900];
    let failures: ProgressVerificationFailure[] = [];
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
      failures = day.sections.flatMap<ProgressVerificationFailure>((section) => {
        const expectedPointsEarned = getClampedSectionPoints(section, expectedPointsBySectionId[section.id] ?? 0);
        const actualPointsEarned = getClampedSectionPoints(section, loaded.data.sectionPointsEarned[section.id] ?? 0);

        return expectedPointsEarned === actualPointsEarned
          ? []
          : [
              {
                actualPointsEarned,
                expectedPointsEarned,
                progressId: loaded.data.expectedProgressIdsBySectionId[section.id],
                sectionId: section.id
              }
            ];
      });

      if (failures.length === 0) {
        return { ok: true };
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("Journal progress verification failed", {
        completedSectionIds: lastLoaded?.completedSectionIds ?? [],
        dayNumber: day.dayNumber,
        failures,
        groupId: activeGroup.groupId,
        programId: program.program.id,
        weekNumber
      });
    }

    return {
      ok: false,
      error: "The completion save could not be verified. Use Retry save before leaving."
    };
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
  }, [answers, completedSectionIds, sectionPointsEarned, sectionCompletedItemIds]);

  function toggleSection(sectionId: string) {
    hasUserChangedRef.current = true;
    setSaveStatus("idle");
    setSaveError("");
    const section = day?.sections.find((candidate) => candidate.id === sectionId);
    const nextPoints = completedSectionIdsRef.current.includes(sectionId) ? 0 : getSectionMaxPoints(section);
    updateSectionProgress(sectionId, nextPoints);
    void saveRef.current();
  }

  function updatePartialSection(section: ProgramSection, completionCount: number) {
    hasUserChangedRef.current = true;
    setSaveStatus("idle");
    setSaveError("");
    updateSectionProgress(section.id, getPointsFromCompletionCount(section, completionCount), []);
  }

  function updateCompletionItem(section: ProgramSection, itemId: string, checked: boolean) {
    const currentItemIds = getCompletionItemIdsFromRefs(section);
    const nextItemIds = checked
      ? currentItemIds.filter((candidate) => candidate !== itemId)
      : orderCompletionItemIds(section, [...currentItemIds, itemId]);

    updateSectionProgress(section.id, getPointsFromCompletionItemIds(section, nextItemIds), nextItemIds);
    void saveRef.current();
  }

  function updateSectionProgress(sectionId: string, pointsEarned: number, completedItemIds?: string[]) {
    const nextPointsEarned = getClampedSectionPoints(
      day?.sections.find((candidate) => candidate.id === sectionId),
      pointsEarned
    );
    const nextSectionPointsEarned = { ...sectionPointsEarnedRef.current, [sectionId]: nextPointsEarned };
    const nextSectionCompletedItemIds = {
      ...sectionCompletedItemIdsRef.current,
      [sectionId]: nextPointsEarned > 0 ? completedItemIds ?? sectionCompletedItemIdsRef.current[sectionId] ?? [] : []
    };
    const nextCompletedSectionIds =
      nextPointsEarned > 0
        ? Array.from(new Set([...completedSectionIdsRef.current, sectionId]))
        : completedSectionIdsRef.current.filter((id) => id !== sectionId);

    sectionPointsEarnedRef.current = nextSectionPointsEarned;
    sectionCompletedItemIdsRef.current = nextSectionCompletedItemIds;
    completedSectionIdsRef.current = nextCompletedSectionIds;
    setSectionPointsEarned(nextSectionPointsEarned);
    setSectionCompletedItemIds(nextSectionCompletedItemIds);
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
        sectionPointsEarnedRef.current = {
          ...sectionPointsEarnedRef.current,
          [sectionId]: getSectionMaxPoints(day?.sections.find((section) => section.id === sectionId))
        };
        setCompletedSectionIds(nextCompletedSectionIds);
        setSectionPointsEarned(sectionPointsEarnedRef.current);
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

  function isPartialSection(section: ProgramSection): boolean {
    return Boolean(section.maxCompletions && section.maxCompletions > 1 && section.pointsPerCompletion);
  }

  function hasCompletionItems(section: ProgramSection): boolean {
    return Boolean(section.completionItems && section.completionItems.length > 0);
  }

  function shouldShowCompletionControl(section: ProgramSection): boolean {
    return section.points > 0 && !isDashboardCompletionSection(section);
  }

  function isDashboardCompletionSection(section: ProgramSection): boolean {
    if (!day || day.title.trim().toLowerCase() !== "reading and reflection") {
      return false;
    }

    const simpleCompletionSections = day.sections
      .filter((daySection) => daySection.points > 0)
      .filter((daySection) => !isDashboardPartialSection(daySection));

    return simpleCompletionSections.length === 1 && simpleCompletionSections[0]?.id === section.id;
  }

  function isDashboardPartialSection(section: ProgramSection): boolean {
    return Boolean(section.completionItems?.length || (section.maxCompletions && section.maxCompletions > 1));
  }

  function shouldShowFallbackReflection(section: ProgramSection): boolean {
    return section.points > 0 && !isPartialSection(section);
  }

  function shouldShowPointLabel(section: ProgramSection): boolean {
    return (section.points > 0 || isPartialSection(section)) && !isDashboardCompletionSection(section);
  }

  function getSectionMaxPoints(section?: ProgramSection): number {
    return Math.max(0, section?.points ?? 0);
  }

  function getClampedSectionPoints(section: ProgramSection | undefined, pointsEarned: number): number {
    if (!Number.isFinite(pointsEarned)) {
      return 0;
    }

    return Math.min(getSectionMaxPoints(section), Math.max(0, Math.round(pointsEarned)));
  }

  function getCompletionCount(section: ProgramSection, pointsEarned: number): number {
    const pointsPerCompletion = section.pointsPerCompletion ?? 1;
    return Math.min(section.maxCompletions ?? 1, Math.max(0, Math.round(pointsEarned / pointsPerCompletion)));
  }

  function getCompletionOptions(section: ProgramSection): number[] {
    return Array.from({ length: (section.maxCompletions ?? 0) + 1 }, (_, index) => index);
  }

  function getCompletionItems(section: ProgramSection) {
    return section.completionItems ?? [];
  }

  function getCompletionItemIds(section: ProgramSection): string[] {
    return orderCompletionItemIds(section, sectionCompletedItemIds[section.id] ?? []);
  }

  function getCompletionItemIdsFromRefs(section: ProgramSection): string[] {
    return orderCompletionItemIds(section, sectionCompletedItemIdsRef.current[section.id] ?? []);
  }

  function orderCompletionItemIds(section: ProgramSection, itemIds: string[]): string[] {
    const selectedItemIds = new Set(itemIds);
    return getCompletionItems(section)
      .filter((item) => selectedItemIds.has(item.id))
      .map((item) => item.id);
  }

  function getPointsFromCompletionItemIds(section: ProgramSection, itemIds: string[]): number {
    return getPointsFromCompletionCount(section, itemIds.length);
  }

  function getPointsFromCompletionCount(section: ProgramSection, completionCount: number): number {
    const maxCompletions = section.maxCompletions ?? 1;
    const pointsPerCompletion = section.pointsPerCompletion ?? 1;
    const clampedCount = Math.min(maxCompletions, Math.max(0, Math.round(completionCount)));
    return getClampedSectionPoints(section, clampedCount * pointsPerCompletion);
  }

  function getSectionPointLabel(section: ProgramSection): string {
    if (!isPartialSection(section)) {
      return formatPoints(section.points);
    }

    const unit = section.completionUnit ?? "completion";
    const pluralUnit = unit.endsWith("s") ? unit : `${unit}s`;
    const pointsPerCompletion = section.pointsPerCompletion ?? 1;
    return `${formatPoints(pointsPerCompletion)} per ${unit}, ${section.maxCompletions} ${pluralUnit} max`;
  }

  function getCompletionControlLabel(section: ProgramSection): string {
    const unit = section.completionUnit ?? "completion";
    const pluralUnit = unit.endsWith("s") ? unit : `${unit}s`;
    return `${capitalize(pluralUnit)} completed`;
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
  const dayEarnedPoints =
    day?.sections.reduce(
      (sum, section) => sum + getClampedSectionPoints(section, sectionPointsEarned[section.id] ?? 0),
      0
    ) ?? 0;
  const dayProgressPct = dayMaxPoints > 0 ? Math.round((dayEarnedPoints / dayMaxPoints) * 100) : 0;

  return (
    <div className="stack">
      <div>
        <Link className="button" href={`/dashboard?week=${weekNumber}`}>
          Back to Week {weekNumber}
        </Link>
      </div>

      <section className="panel stack">
        <div className="row">
          <h1>{day ? getProgramDayDisplayName(day) : "Program day"}</h1>
          {isReadOnly ? null : (
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
          )}
        </div>
        {isReadOnly ? (
          <p className="archived-notice" role="status">
            This program is archived. Your journal is read-only.
          </p>
        ) : null}
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
        <section className={`panel${(sectionPointsEarned[section.id] ?? 0) > 0 ? " section-complete" : ""}`} key={section.id}>
          <div className="section-layout">
            {!shouldShowCompletionControl(section) || isPartialSection(section) ? (
              <span className="section-check" aria-hidden="true" />
            ) : (
              <label className="section-check" aria-label={`Mark ${section.title} complete`}>
                <input
                  checked={completedSectionIds.includes(section.id)}
                  disabled={isReadOnly}
                  onChange={() => toggleSection(section.id)}
                  type="checkbox"
                />
              </label>
            )}

            <div className="section-content">
              <div>
                {shouldShowPointLabel(section) ? <p className="eyebrow">{getSectionPointLabel(section)}</p> : null}
                <h2>{section.title}</h2>
              </div>
              {section.body ? <p>{section.body}</p> : null}
              {isPartialSection(section) ? (
                <div className="field compact-field">
                  <span>{getCompletionControlLabel(section)}</span>
                  {hasCompletionItems(section) ? (
                    <div className="completion-checklist" role="group" aria-label={getCompletionControlLabel(section)}>
                      {getCompletionItems(section).map((item, itemIndex) => {
                        const checked = getCompletionItemIds(section).includes(item.id);

                        return (
                          <label className="completion-check-item" key={item.id}>
                            <input
                              checked={checked}
                              disabled={isReadOnly}
                              onChange={() => updateCompletionItem(section, item.id, checked)}
                              type="checkbox"
                            />
                            <span>{item.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="completion-picker" role="group" aria-label={getCompletionControlLabel(section)}>
                      {getCompletionOptions(section).map((completionCount) => {
                        const selected = completionCount === getCompletionCount(section, sectionPointsEarned[section.id] ?? 0);

                        return (
                          <button
                            className={selected ? "active" : ""}
                            disabled={isReadOnly}
                            key={completionCount}
                            onClick={() => {
                              updatePartialSection(section, completionCount);
                              void saveRef.current();
                            }}
                            type="button"
                          >
                            {completionCount}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <small className="muted">
                    {sectionPointsEarned[section.id] ?? 0}/{section.points} points
                  </small>
                </div>
              ) : null}
              {section.scripture?.map((scripture) => (
                <blockquote className="scripture" key={scripture.reference}>
                  <strong>{scripture.reference}</strong>
                  <p>{scripture.text}</p>
                </blockquote>
              ))}
              {section.breathPrayer && section.breathPrayer.length > 0 ? (
                <div className="breath-prayer" aria-label="Breath prayer">
                  <p className="eyebrow">Breathe the following prayer</p>
                  <div className="breath-prayer-grid">
                    {section.breathPrayer.map((pair, pairIndex) => (
                      <div className="breath-prayer-row" key={`${pair.inhale}-${pairIndex}`}>
                        <div>
                          <span>Inhale {pairIndex + 1}</span>
                          <p>{pair.inhale}</p>
                        </div>
                        <div>
                          <span>Exhale {pairIndex + 1}</span>
                          <p>{pair.exhale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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
                            readOnly={isReadOnly}
                            value={resolveJournalAnswer(answers, section.id, promptStorageId)}
                          onChange={(event) => {
                            updateAnswer(answerKey, section.id, event.target.value);
                            resizeTextarea(event.currentTarget);
                          }}
                          onBlur={() => void saveRef.current()}
                          placeholder={decryptFailed ? "Type replacement text here" : "Write your response"}
                        />
                          {decryptFailed && !replacementApproved && !isReadOnly ? (
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
                : !needsReauth && shouldShowFallbackReflection(section) ? (() => {
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
                          readOnly={isReadOnly}
                          value={answers[reflectionId] ?? ""}
                          onChange={(event) => {
                            updateAnswer(reflectionId, section.id, event.target.value);
                            resizeTextarea(event.currentTarget);
                          }}
                          onBlur={() => void saveRef.current()}
                          placeholder={decryptFailed ? "Type replacement text here" : "Write your response"}
                        />
                        {decryptFailed && !replacementApproved && !isReadOnly ? (
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

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
