export class LinkUserTaxpayerCommand {
  constructor(
    public readonly userId: string,
    public readonly nrc: string,
    public readonly nit: string,
    public readonly name: string,
  ) {}

}
