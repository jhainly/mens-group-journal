export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  salt: string;
  keyDerivation: "PBKDF2-SHA-256";
  iterations: number;
  algorithm: "AES-GCM";
  version: 1;
};

const ITERATIONS = 310000;
const KEY_LENGTH = 256;
const IV_BYTES = 12;
const SALT_BYTES = 16;
type BrowserBytes = Uint8Array<ArrayBuffer>;

export async function encryptJournalAnswer(plaintext: string, secret: string): Promise<EncryptedPayload> {
  assertBrowserCrypto();
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(secret, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
    keyDerivation: "PBKDF2-SHA-256",
    iterations: ITERATIONS,
    algorithm: "AES-GCM",
    version: 1
  };
}

export async function decryptJournalAnswer(payload: EncryptedPayload, secret: string): Promise<string> {
  assertBrowserCrypto();
  const key = await deriveKey(secret, base64ToBytes(payload.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}

export function canEncryptJournalAnswers(): boolean {
  return Boolean(globalThis.crypto?.subtle);
}

export function getJournalEncryptionRequirementMessage(): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Journal reflections can only be saved from localhost or HTTPS because encryption must happen in the browser before storage.";
  }

  return "Journal reflections cannot be saved because this browser does not provide the Web Crypto API.";
}

async function deriveKey(secret: string, salt: BrowserBytes): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

function assertBrowserCrypto(): void {
  if (!canEncryptJournalAnswers()) {
    throw new Error(getJournalEncryptionRequirementMessage());
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
