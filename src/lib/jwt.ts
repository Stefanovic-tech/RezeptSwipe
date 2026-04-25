import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env";

const ISSUER = "rezeptswipe";

function key(): Uint8Array {
  return new TextEncoder().encode(env.auth.secret);
}

export interface AccessClaims extends JWTPayload {
  sub: string;
  isAdmin?: boolean;
  hh?: number | null;
  username?: string;
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${env.auth.accessTtlMinutes}m`)
    .sign(key());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER });
    return payload as AccessClaims;
  } catch {
    return null;
  }
}
