"use client";

export type JournalKeyEnvelope = {
  algorithm: "AES-GCM";
  ciphertext: string;
  iterations: number;
  iv: string;
  keyDerivation: "PBKDF2-SHA-256";
  salt: string;
  version: 1;
};

const SESSION_STORAGE_KEY = "mgj_journal_key";
const ITERATIONS = 310000;
const KEY_LENGTH = 256;
const JOURNAL_KEY_BYTES = 32;
const IV_BYTES = 12;
const SALT_BYTES = 16;
type BrowserBytes = Uint8Array<ArrayBuffer>;

export async function initializeJournalEncryptionSecret(input: {
  email: string;
  legacySecret?: string;
  password: string;
  envelope?: JournalKeyEnvelope | null;
}): Promise<{ envelope?: JournalKeyEnvelope; secret: string }> {
  assertBrowserCrypto();

  if (input.envelope) {
    const secret = await unwrapJournalSecret(input.email, input.password, input.envelope);
    setCurrentJournalSecret(secret);
    return { secret };
  }

  const secret = input.legacySecret ?? bytesToBase64(randomBytes(JOURNAL_KEY_BYTES));
  const envelope = await wrapJournalSecret(input.email, input.password, secret);
  setCurrentJournalSecret(secret);
  return { envelope, secret };
}

export function getJournalEncryptionSecret(): string | null {
  return sessionStorage.getItem(SESSION_STORAGE_KEY);
}

export function clearJournalEncryptionSecret(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function wrapCurrentJournalEncryptionSecret(input: {
  email: string;
  password: string;
}): Promise<JournalKeyEnvelope> {
  assertBrowserCrypto();
  const secret = getJournalEncryptionSecret();

  if (!secret) {
    throw new Error("Sign in again before changing your password.");
  }

  return wrapJournalSecret(input.email, input.password, secret);
}

async function wrapJournalSecret(email: string, password: string, secret: string): Promise<JournalKeyEnvelope> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveWrappingKey(email, password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret));

  return {
    algorithm: "AES-GCM",
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iterations: ITERATIONS,
    iv: bytesToBase64(iv),
    keyDerivation: "PBKDF2-SHA-256",
    salt: bytesToBase64(salt),
    version: 1
  };
}

async function unwrapJournalSecret(email: string, password: string, envelope: JournalKeyEnvelope): Promise<string> {
  const key = await deriveWrappingKey(email, password, base64ToBytes(envelope.salt), envelope.iterations);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.ciphertext)
  );

  return new TextDecoder().decode(plaintext);
}

async function deriveWrappingKey(
  email: string,
  password: string,
  salt: BrowserBytes,
  iterations = ITERATIONS
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${email.trim().toLowerCase()}:${password}`),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

function setCurrentJournalSecret(secret: string): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, secret);
}

function assertBrowserCrypto(): void {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is required for journal key protection.");
  }
}

function randomBytes(length: number): BrowserBytes {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(length)));
}

function bytesToBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary);
}

function base64ToBytes(value: string): BrowserBytes {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
