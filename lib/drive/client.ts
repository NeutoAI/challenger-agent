import { google } from "googleapis";

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  lastModifyingUserName?: string;
}

/** Decodes the service-account key from its base64 env-var form. Stored base64-encoded
 * because the raw JSON key contains literal newlines in its private key field, which many
 * env-var UIs (including Vercel's) mangle if pasted directly. */
function loadServiceAccountCredentials(): { client_email: string; private_key: string } {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (!encoded) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not set");
  }
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_B64 is not valid base64-encoded JSON");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_B64 is missing client_email or private_key");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function folderId(): string {
  const id = process.env.POLICY_DRIVE_FOLDER_ID;
  if (!id) throw new Error("POLICY_DRIVE_FOLDER_ID is not set");
  return id;
}

function driveClient() {
  const { client_email, private_key } = loadServiceAccountCredentials();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

/** Lists native Google Docs directly inside the configured policy folder (no recursion —
 * anything an operator wants excluded from consideration should simply live outside this
 * folder). Non-Doc files (PDFs, Word uploads, etc.) are intentionally left out of the query
 * rather than fetched and rejected later, since this integration only supports Google Docs. */
export async function listPolicyDocs(): Promise<DriveFile[]> {
  const drive = driveClient();
  const res = await drive.files.list({
    q: `'${folderId()}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.document'`,
    fields: "files(id, name, modifiedTime, lastModifyingUser(displayName))",
    pageSize: 100,
  });
  const files = res.data.files ?? [];
  return files
    .filter((f): f is typeof f & { id: string; name: string; modifiedTime: string } => !!f.id && !!f.name && !!f.modifiedTime)
    .map((f) => ({
      id: f.id,
      name: f.name,
      modifiedTime: f.modifiedTime,
      lastModifyingUserName: f.lastModifyingUser?.displayName ?? undefined,
    }));
}

/** Exports a Google Doc's body as plain text — no extraction library needed since Drive
 * does the conversion server-side. */
export async function exportDocText(fileId: string): Promise<string> {
  const drive = driveClient();
  const res = await drive.files.export({ fileId, mimeType: "text/plain" }, { responseType: "text" });
  return res.data as string;
}
