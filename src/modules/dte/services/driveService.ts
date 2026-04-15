import { google } from "googleapis";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Readable } from "stream";

dotenv.config();

// Determine the path to the credentials file
const credentialsPath = path.join(process.cwd(), "google-credentials.json");

/**
 * Initializes the Google Drive API client using a Service Account
 */
export const getDriveClient = () => {
  const oauthClientId = process.env.GOOGLE_CLIENT_ID;
  const oauthClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const oauthRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  // Priority 1: OAuth2 (For personal @gmail.com accounts)
  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      oauthClientId,
      oauthClientSecret
    );
    oauth2Client.setCredentials({
      refresh_token: oauthRefreshToken,
    });
    return google.drive({ version: "v3", auth: oauth2Client });
  }

  // Priority 2: Service Account (For Workspace or dedicated accounts)
  const envCredentials = process.env.GOOGLE_CREDENTIALS_JSON;
  let authConfig: any = {
    scopes: ["https://www.googleapis.com/auth/drive"],
  };

  if (envCredentials) {
    try {
      authConfig.credentials = JSON.parse(envCredentials);
    } catch (error) {
      console.error("Error parsing GOOGLE_CREDENTIALS_JSON from environment:", error);
      throw new Error("Invalid GOOGLE_CREDENTIALS_JSON provided in environment variables.");
    }
  } else if (fs.existsSync(credentialsPath)) {
    authConfig.keyFile = credentialsPath;
  } else {
    throw new Error(
      `Google credentials not found (checked OAuth2 variables, GOOGLE_CREDENTIALS_JSON env var and ${credentialsPath} file).`
    );
  }

  const impersonateEmail = process.env.GOOGLE_IMPERSONATE_EMAIL;
  if (impersonateEmail) {
    authConfig.clientOptions = {
      subject: impersonateEmail,
    };
  }

  const auth = new google.auth.GoogleAuth(authConfig);
  return google.drive({ version: "v3", auth });
};

/**
 * Finds a folder by name inside a specific parent ID.
 */
export const findFolder = async (
  drive: any,
  folderName: string,
  parentId: string
): Promise<string | null> => {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
  const response = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    spaces: "drive",
  });
  const files = response.data.files;
  if (files && files.length > 0) {
    return files[0].id;
  }
  return null;
};

/**
 * Creates a folder inside a designated parent.
 */
export const createFolder = async (
  drive: any,
  folderName: string,
  parentId: string
): Promise<string> => {
  const fileMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId],
  };
  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: "id",
  });
  return folder.data.id;
};

/**
 * Recursively resolves or creates a folder path like 'api/dte/attachment/2026/04'
 * starting from a base root ID.
 */
export const resolveFolderPath = async (
  drive: any,
  folderPath: string,
  rootId: string
): Promise<string> => {
  const parts = folderPath.split("/").filter((p) => p.trim() !== "");
  let currentParentId = rootId;

  for (const part of parts) {
    let nextId = await findFolder(drive, part, currentParentId);
    if (!nextId) {
      nextId = await createFolder(drive, part, currentParentId);
    }
    currentParentId = nextId;
  }
  return currentParentId;
};

/**
 * Uploads a file via Buffer to Google Drive
 */
export const uploadBufferToDrive = async (
  filename: string,
  contentBuffer: Buffer,
  mimeType: string,
  folderPath?: string
): Promise<string | null> => {
  if (!contentBuffer || contentBuffer.length === 0) {
    console.error(`Attempted to upload empty buffer for file: ${filename}`);
    return null;
  }
  
  console.log(`Uploading file to Drive: ${filename} (${contentBuffer.length} bytes)`);
  try {
    const rootTargetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!rootTargetFolderId) {
      console.warn("No root target folder ID provided (GOOGLE_DRIVE_FOLDER_ID) for Google Drive upload.");
      return null;
    }

    const drive = getDriveClient();
    
    // Resolve dynamic path if provided
    const targetFolderId = folderPath 
      ? await resolveFolderPath(drive, folderPath, rootTargetFolderId)
      : rootTargetFolderId;

    const fileMetadata = {
      name: filename,
      parents: [targetFolderId],
    };

    const media = {
      mimeType: mimeType,
      body: Readable.from(contentBuffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    });

    return response.data.id || null;
  } catch (error) {
    console.error("Error uploading buffer to Google Drive:", error);
    return null;
  }
};

/**
 * Lists all files inside a specific path
 */
export const listFilesInDrivePath = async (folderPath: string): Promise<any[]> => {
  try {
    const rootTargetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootTargetFolderId) return [];

    const drive = getDriveClient();
    const targetFolderId = await resolveFolderPath(drive, folderPath, rootTargetFolderId);

    const query = `'${targetFolderId}' in parents and trashed=false`;
    const response = await drive.files.list({
      q: query,
      fields: "files(id, name, mimeType)",
    });

    return response.data.files || [];
  } catch (error) {
    console.error(`Error listing files in Drive path ${folderPath}:`, error);
    return [];
  }
};

/**
 * Download a file from Google Drive directly into a Buffer
 */
export const downloadDriveFileToBuffer = async (fileId: string): Promise<Buffer | null> => {
  try {
    const drive = getDriveClient();
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      res.data.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      res.data.on("end", () => resolve(Buffer.concat(chunks)));
      res.data.on("error", (err: any) => reject(err));
    });
  } catch (error) {
    console.error(`Error downloading file ${fileId} from Drive:`, error);
    return null;
  }
};

/**
 * Delete a file in Google Drive permanently
 */
export const deleteDriveFile = async (fileId: string): Promise<boolean> => {
  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
    return true;
  } catch (error) {
    console.error(`Error deleting file ${fileId} from Drive:`, error);
    return false;
  }
};
