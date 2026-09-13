"use client";

import type { UserGroupSummary } from "@/lib/services/dataClient";

const STORAGE_KEY = "mgj_selected_group_id";

type GroupLabelSource = {
  activeProgramTitle?: string;
  isArchived?: boolean;
  name: string;
};

export function getSelectedGroupId(): string | null {
  return sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
}

export function setSelectedGroupId(groupId: string): void {
  sessionStorage.setItem(STORAGE_KEY, groupId);
  localStorage.setItem(STORAGE_KEY, groupId);
}

export function clearSelectedGroupId(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Prefer the remembered group; otherwise default to the first active (non-archived) group so
 * members land on the current program rather than an archived one.
 */
export function resolveSelectedGroup<T extends Pick<UserGroupSummary, "groupId" | "isArchived">>(groups: T[]): T | null {
  const selectedGroupId = getSelectedGroupId();
  const selectedGroup = groups.find((group) => group.groupId === selectedGroupId);
  return selectedGroup ?? groups.find((group) => !group.isArchived) ?? groups[0] ?? null;
}

/**
 * Switcher label in the form "Program - Group", with an Archived marker. Groups that have no
 * program imported yet show their name alone.
 */
export function getGroupDisplayName(group: GroupLabelSource): string {
  const base = group.activeProgramTitle ? `${group.activeProgramTitle} - ${group.name}` : group.name;
  return group.isArchived ? `${base} (Archived)` : base;
}
