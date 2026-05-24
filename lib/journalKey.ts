"use client";

const STORAGE_KEY = "mgj_journal_key";

export function setJournalEncryptionSecret(email: string, password: string): void {
  sessionStorage.setItem(STORAGE_KEY, `${email.trim().toLowerCase()}:${password}`);
}

export function getJournalEncryptionSecret(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearJournalEncryptionSecret(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
