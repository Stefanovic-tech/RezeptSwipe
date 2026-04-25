import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function randomToken(byteLength = 48): string {
  return randomBytes(byteLength).toString("base64url");
}

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return out;
}

export function generateRecoveryCodes(count = 8, segments = 2, segmentLength = 5): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const parts: string[] = [];
    for (let s = 0; s < segments; s++) {
      const bytes = randomBytes(segmentLength);
      let part = "";
      for (let j = 0; j < segmentLength; j++) {
        part += INVITE_ALPHABET[bytes[j] % INVITE_ALPHABET.length];
      }
      parts.push(part);
    }
    out.push(parts.join("-"));
  }
  return out;
}

export function normalizeInviteCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}
