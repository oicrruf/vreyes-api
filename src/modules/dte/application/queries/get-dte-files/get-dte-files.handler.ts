import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import fs from 'fs';
import path from 'path';
import { GetDteFilesQuery } from './get-dte-files.query';
import { AppLoggerFactory, AppLogger } from '../../../../../shared/logging/app-logger.factory';

export interface DteFileInfo {
  filename: string;
  size: number;
  mtime: Date;
  extension: string;
}

export interface GetDteFilesResult {
  period: string;
  type: string;
  count: number;
  files: DteFileInfo[];
}

@QueryHandler(GetDteFilesQuery)
export class GetDteFilesHandler implements IQueryHandler<GetDteFilesQuery, GetDteFilesResult> {
  private readonly logger: AppLogger;

  constructor(private readonly loggerFactory: AppLoggerFactory) {
    // TODO: replace 'system' with real userId from auth context
    this.logger = this.loggerFactory.create(process.env.DEFAULT_USER_ID ?? 'system', 'dte');
  }

  async execute(query: GetDteFilesQuery): Promise<GetDteFilesResult> {
    const { year, type } = query;
    const formattedMonth = query.month.padStart(2, '0');

    const basePath = process.env.ATTACHMENTS_PATH ?? './attachments';
    const dirPath = path.join(basePath, year, formattedMonth, type);

    if (!fs.existsSync(dirPath)) {
      this.logger.error(`Directory not found: ${dirPath}`);
      throw new Error(`No files found for ${year}/${formattedMonth} in ${type}`);
    }

    const files: DteFileInfo[] = fs.readdirSync(dirPath).map((file) => {
      const stats = fs.statSync(path.join(dirPath, file));
      return {
        filename: file,
        size: stats.size,
        mtime: stats.mtime,
        extension: path.extname(file).replace('.', '').toLowerCase(),
      };
    });

    return {
      period: `${year}-${formattedMonth}`,
      type,
      count: files.length,
      files,
    };
  }
}
