import { NextResponse } from "next/server";
import { checkPassword, createSession, destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkPassword(password)) {
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }

  await createSession();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
