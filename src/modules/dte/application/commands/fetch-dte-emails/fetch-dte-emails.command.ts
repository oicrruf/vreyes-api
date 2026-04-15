import { DteType } from '../../../domain/ports/dte-repository.port';

export class FetchDteEmailsCommand {
  constructor(
    public readonly type: DteType,
    public readonly year?: number,
    public readonly month?: number,
  ) {}
}
