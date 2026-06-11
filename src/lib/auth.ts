import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "hl_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret(): string {
  return process.env.SESSION_SECRET || "dev-secret";
}

/** Deterministic signed token for the shared login. */
function makeToken(): string {
  return createHmac("sha256", secret()).update("authenticated").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Validate the submitted shared password. */
export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD || "";
  if (!expected) return false;
  return safeEqual(input, expected);
}

export async function createSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, makeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return safeEqual(token, makeToken());
}

/** Server-component guard: redirect to /login when not authenticated. */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login");
}

export const SESSION_COOKIE = COOKIE_NAME;
