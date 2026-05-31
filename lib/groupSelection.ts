"use client";

import type { UserGroupSummary } from "@/lib/services/dataClient";

const STORAGE_KEY = "mgj_selected_group_id";

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

export function resolveSelectedGroup(groups: UserGroupSummary[]): UserGroupSummary | null {
  const selectedGroupId = getSelectedGroupId();
  const selectedGroup = groups.find((group) => group.groupId === selectedGroupId);
  return selectedGroup ?? groups[0] ?? null;
}
