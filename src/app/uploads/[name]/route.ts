import { NextResponse } from "next/server";
import path from "node:path";
import { isAuthenticated } from "@/lib/auth";
import { downloadInvoiceFile } from "@/lib/storage";

export const runtime = "nodejs";

// Serves an uploaded invoice scan from the private Supabase bucket, behind auth.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name } = await params;

  // Prevent path traversal — only a bare object name is allowed.
  const safe = path.basename(name);
  if (safe !== name) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const file = await downloadInvoiceFile(safe);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
