export const FILE_STORAGE = 'FILE_STORAGE';

export interface FileInfo {
  id: string;
  name: string;
  mimeType: string;
}

export interface FileStoragePort {
  upload(
    filename: string,
    content: Buffer,
    mimeType: string,
    folderPath?: string,
  ): Promise<string | null>;

  list(folderPath: string): Promise<FileInfo[]>;

  download(fileId: string): Promise<Buffer | null>;

  delete(fileId: string): Promise<boolean>;
}
