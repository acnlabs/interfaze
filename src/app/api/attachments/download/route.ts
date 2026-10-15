import { attachmentDownload } from "@/lib/attachmentDownload";

export const runtime = "nodejs";
// Up to 10s to authorize/open storage, then a bounded 60s body transfer.
export const maxDuration = 75;

export async function GET(request: Request): Promise<Response> {
  return attachmentDownload(request);
}
