import path from "node:path";

// Where uploaded invoice images/PDFs are stored.
// Local dev: <project>/uploads. On Render: set UPLOAD_DIR to the persistent
// disk mount (e.g. /var/data/uploads) so files survive redeploys.
export function uploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}
