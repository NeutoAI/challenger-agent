import { runDriveSync } from "@/lib/drive/sync";

/** Server-side only — keeps the service-account key off the client, same boundary as
 * ANTHROPIC_API_KEY in app/api/chat/route.ts. Deliberately does not fall back to any demo
 * data on failure: an operator relying on this to know what's "currently approved" should see
 * a clear error, not silently-stale or fake-looking data (see PolicySourceCard.tsx). */
export async function POST(): Promise<Response> {
  try {
    const result = await runDriveSync();
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error contacting Google Drive";
    return Response.json({ error: message }, { status: 502 });
  }
}
