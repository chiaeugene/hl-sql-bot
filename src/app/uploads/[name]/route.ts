import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isAuthenticated } from "@/lib/auth";
import { uploadDir } from "@/lib/uploads";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

// Serves an uploaded invoice from the (possibly off-disk) upload dir, behind auth.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name } = await params;

  // Prevent path traversal — only a bare filename is allowed.
  const safe = path.basename(name);
  if (safe !== name) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const data = await readFile(path.join(uploadDir(), safe));
    const ext = path.extname(safe).toLowerCase();
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
