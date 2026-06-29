import { beforeEach, describe, expect, it } from 'vitest';

import {
  LOCAL_PERIPHERAL_SETTINGS_STORAGE_KEY,
  STORE_SETTINGS_STORAGE_KEY,
  readLocalPeripheralSettings,
  readStoreSettings,
  roleCanAccessStore,
  runPrinterCommunicationTest,
  runScaleCommunicationTest,
  saveLocalPeripheralSettings,
  saveStoreSettings
} from '@/modules/admin/infrastructure/local/platformSettings';

describe('platform settings locais', () => {
  beforeEach(() => {
    saveStoreSettings([]);
    saveLocalPeripheralSettings(readLocalPeripheralSettings());
  });

  it('cria loja padrão ativa para primeiro acesso', () => {
    const stores = readStoreSettings();

    expect(stores).toHaveLength(1);
    expect(stores[0].name).toBe('Desenvolvimento');
    expect(stores[0].legalName).toBe('Desenvolvimento');
    expect(stores[0].tradeName).toBe('Desenvolvimento');
    expect(roleCanAccessStore('ADMIN', stores[0])).toBe(true);
    expect(roleCanAccessStore('CAIXA', stores[0])).toBe(true);
    expect(STORE_SETTINGS_STORAGE_KEY).toBe('pdv.platform.stores');
  });

  it('bloqueia perfil operacional quando não está vinculado à loja', () => {
    const [store] = readStoreSettings();
    const savedStores = saveStoreSettings([{
      ...store,
      id: 'store-1',
      name: 'Restaurante Teste',
      legalName: 'Restaurante Teste LTDA',
      tradeName: 'Restaurante Teste',
      allowedRoles: ['GERENTE']
    }]);

    expect(roleCanAccessStore('ADMIN', savedStores[0])).toBe(true);
    expect(roleCanAccessStore('GERENTE', savedStores[0])).toBe(true);
    expect(roleCanAccessStore('CAIXA', savedStores[0])).toBe(false);
  });

  it('persiste periféricos locais e valida testes mínimos', () => {
    const settings = readLocalPeripheralSettings();
    expect(settings.scales).toHaveLength(1);
    expect(settings.scales[0].name).toBe('Balança principal');

    const scaleWithError = runScaleCommunicationTest({
      ...settings.scales[0],
      port: ''
    });
    const printerWithError = runPrinterCommunicationTest({
      ...settings.cashierPrinter,
      connection: 'ETHERNET',
      ipAddress: ''
    });

    expect(scaleWithError.status).toBe('ERRO');
    expect(printerWithError.status).toBe('ERRO');

    const saved = saveLocalPeripheralSettings({
      ...settings,
      computerName: 'Caixa principal',
      scales: [
        runScaleCommunicationTest({
          ...settings.scales[0],
          port: 'COM3'
        }),
        runScaleCommunicationTest({
          ...settings.scales[0],
          id: 'scale-copa',
          name: 'Balança da copa',
          serialNumber: '987654',
          port: 'COM4'
        })
      ],
      scale: runScaleCommunicationTest({
        ...settings.scales[0],
        port: 'COM3'
      }),
      cashierPrinter: runPrinterCommunicationTest({
        ...settings.cashierPrinter,
        connection: 'USB',
        driverName: 'Elgin i9 Full'
      })
    });

    expect(saved.scale.status).toBe('ATIVO');
    expect(saved.scales).toHaveLength(2);
    expect(saved.scales[1].name).toBe('Balança da copa');
    expect(saved.scales[1].status).toBe('ATIVO');
    expect(saved.cashierPrinter.status).toBe('ATIVO');
    expect(readLocalPeripheralSettings().computerName).toBe('Caixa principal');
    expect(LOCAL_PERIPHERAL_SETTINGS_STORAGE_KEY).toBe('pdv.local.peripherals');
  });
});
