import type { CreateConvenioInput } from '@/modules/convenios/application/dto/CreateConvenioInput';
import type { Convenio } from '@/modules/convenios/domain/entities/Convenio';
import type { ConvenioRepository } from '@/modules/convenios/domain/ports/ConvenioRepository';

export class CreateConvenio {
  constructor(private readonly convenioRepository: ConvenioRepository) {}

  async execute(input: CreateConvenioInput): Promise<Convenio> {
    const now = new Date();

    const convenio: Convenio = {
      id: input.id,
      convenioCode: input.convenioCode,
      name: input.name,
      cpfCnpj: input.cpfCnpj,
      stateRegistration: input.stateRegistration,
      tradeName: input.tradeName,
      personType: input.personType,
      birthDate: input.birthDate,
      rg: input.rg,
      municipalRegistration: input.municipalRegistration,
      gender: input.gender,
      entryOrigin: input.entryOrigin,
      deliveryServiceFee: input.deliveryServiceFee,
      customerConvenio: input.customerConvenio,
      managerName: input.managerName,
      phone: input.phone,
      mobile: input.mobile,
      email: input.email,
      cep: input.cep,
      address: input.address,
      number: input.number,
      neighborhood: input.neighborhood,
      state: input.state,
      city: input.city,
      complement: input.complement,
      stateTaxpayerType: input.stateTaxpayerType,
      activityType: input.activityType,
      freightMode: input.freightMode,
      creditLimit: input.creditLimit,
      debitLimit: input.debitLimit,
      fiadoLimit: input.fiadoLimit,
      creditCardLimit: input.creditCardLimit,
      discountPercent: input.discountPercent,
      commissionPercent: input.commissionPercent,
      visitDay: input.visitDay,
      visitRegion: input.visitRegion,
      printLocation: input.printLocation,
      crt: input.crt,
      cnae: input.cnae,
      priceTable: input.priceTable,
      cei: input.cei,
      constructionRegistration: input.constructionRegistration,
      category: input.category,
      suframa: input.suframa,
      billingCondition: input.billingCondition,
      carrierName: input.carrierName,
      paymentMethod: input.paymentMethod,
      cashFlow: input.cashFlow,
      bankName: input.bankName,
      accountName: input.accountName,
      active: input.active,
      notes: input.notes,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    await this.convenioRepository.save(convenio);
    return convenio;
  }
}
