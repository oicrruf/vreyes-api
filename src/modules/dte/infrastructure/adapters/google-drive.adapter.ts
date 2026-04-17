import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { FileStoragePort, FileInfo } from '../../domain/ports/file-storage.port';

@Injectable()
export class GoogleDriveAdapter implements FileStoragePort {
  private getDriveClient() {
    const oauthClientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const oauthClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const oauthRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
      const oauth2Client = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
      oauth2Client.setCredentials({ refresh_token: oauthRefreshToken });
      return google.drive({ version: 'v3', auth: oauth2Client });
    }

    const envCredentials = process.env.GOOGLE_CREDENTIALS_JSON;
    const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
    const authConfig: any = { scopes: ['https://www.googleapis.com/auth/drive'] };

    if (envCredentials) {
      authConfig.credentials = JSON.parse(envCredentials);
    } else if (fs.existsSync(credentialsPath)) {
      authConfig.keyFile = credentialsPath;
    } else {
      throw new Error('Google credentials not found. Configure OAuth2 or Service Account variables.');
    }

    const impersonateEmail = process.env.GOOGLE_IMPERSONATE_EMAIL;
    if (impersonateEmail) {
      authConfig.clientOptions = { subject: impersonateEmail };
    }

    return google.drive({ version: 'v3', auth: new google.auth.GoogleAuth(authConfig) });
  }

  private async findFolder(drive: any, folderName: string, parentId: string): Promise<string | null> {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
    const response = await drive.files.list({ q: query, fields: 'files(id, name)', spaces: 'drive' });
    return response.data.files?.[0]?.id ?? null;
  }

  private async createFolder(drive: any, folderName: string, parentId: string): Promise<string> {
    const folder = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });
    return folder.data.id;
  }

  private async resolveFolderPath(drive: any, folderPath: string, rootId: string): Promise<string> {
    const parts = folderPath.split('/').filter((p) => p.trim() !== '');
    let currentParentId = rootId;
    for (const part of parts) {
      let nextId = await this.findFolder(drive, part, currentParentId);
      if (!nextId) nextId = await this.createFolder(drive, part, currentParentId);
      currentParentId = nextId;
    }
    return currentParentId;
  }

  async upload(
    filename: string,
    content: Buffer,
    mimeType: string,
    folderPath?: string,
  ): Promise<string | null> {
    if (!content?.length) {
      console.error(`Attempted to upload empty buffer for file: ${filename}`);
      return null;
    }

    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootFolderId) {
      console.warn('GOOGLE_DRIVE_FOLDER_ID not set. Skipping upload.');
      return null;
    }

    try {
      const drive = this.getDriveClient();
      const targetFolderId = folderPath
        ? await this.resolveFolderPath(drive, folderPath, rootFolderId)
        : rootFolderId;

      const existing = await drive.files.list({
        q: `name='${filename}' and '${targetFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive',
      });
      if (existing.data.files?.length) {
        const existingId = existing.data.files[0].id;
        console.log(`File already exists in Drive, skipping upload: ${filename} (${existingId})`);
        return existingId ?? null;
      }

      const response = await drive.files.create({
        requestBody: { name: filename, parents: [targetFolderId] },
        media: { mimeType, body: Readable.from(content) },
        fields: 'id',
      });

      return response.data.id ?? null;
    } catch (err) {
      console.error('Error uploading buffer to Google Drive:', err);
      return null;
    }
  }

  async list(folderPath: string): Promise<FileInfo[]> {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootFolderId) return [];

    try {
      const drive = this.getDriveClient();
      const targetFolderId = await this.resolveFolderPath(drive, folderPath, rootFolderId);
      const response = await drive.files.list({
        q: `'${targetFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
      });
      return (response.data.files ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
      }));
    } catch (err) {
      console.error(`Error listing files in Drive path ${folderPath}:`, err);
      return [];
    }
  }

  async download(fileId: string): Promise<Buffer | null> {
    try {
      const drive = this.getDriveClient();
      const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        res.data.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.data.on('end', () => resolve(Buffer.concat(chunks)));
        res.data.on('error', reject);
      });
    } catch (err) {
      console.error(`Error downloading file ${fileId} from Drive:`, err);
      return null;
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      const drive = this.getDriveClient();
      await drive.files.delete({ fileId });
      return true;
    } catch (err) {
      console.error(`Error deleting file ${fileId} from Drive:`, err);
      return false;
    }
  }
}
