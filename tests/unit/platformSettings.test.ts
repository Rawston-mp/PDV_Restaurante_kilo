import { beforeEach, describe, expect, it } from 'vitest';

import {
  LOCAL_PERIPHERAL_SETTINGS_STORAGE_KEY,
  STORE_SETTINGS_STORAGE_KEY,
  readLocalPeripheralSettings,
  readStoreSettings,
  roleCanAccessStore,
  runScaleCommunicationTest,
  saveLocalPeripheralSettings,
  saveStoreSettings
} from '@/modules/admin/infrastructure/local/platformSettings';
import { changeRolePin, getDefaultPinHint, verifyLoginPin } from '@/modules/auth/infrastructure/local/pinPolicy';

describe('platform settings locais', () => {
  beforeEach(() => {
    const storedValues = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storedValues.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storedValues.set(key, value);
        },
        removeItem: (key: string) => {
          storedValues.delete(key);
        }
      }
    });

    saveStoreSettings([]);
    saveLocalPeripheralSettings(readLocalPeripheralSettings());
    window.localStorage.removeItem('pdv.auth.loginPins');
    window.localStorage.removeItem('pdv.auth.loginPins.store-dev');
    window.localStorage.removeItem('pdv.auth.loginPins.store-alegre');
  });

  it('cria loja padrão ativa para primeiro acesso', () => {
    const stores = readStoreSettings();

    expect(stores).toHaveLength(1);
    expect(stores[0].name).toBe('Desenvolvimento');
    expect(stores[0].legalName).toBe('Desenvolvimento');
    expect(stores[0].tradeName).toBe('Desenvolvimento');
    expect(stores[0].logoUrl).toBe('');
    expect(stores[0].welcomeTitle).toBe('Bem-vindo ao PDV!');
    expect(stores[0].welcomeSubtitle).toBe('Tudo pronto para você realizar ótimas vendas.');
    expect(roleCanAccessStore('ADMIN', stores[0])).toBe(true);
    expect(roleCanAccessStore('CAIXA', stores[0])).toBe(true);
    expect(STORE_SETTINGS_STORAGE_KEY).toBe('pdv.platform.stores');
  });

  it('exibe dica de PIN de login sem expor PIN sensível', () => {
    expect(getDefaultPinHint()).toBe(
      'PIN login: Administrador 9000, Caixa 2025, Balança A 1111, Balança B 2222, Gerente 7700, Atendente 3300.'
    );
  });

  it('aceita PIN de login para gerente e atendente', () => {
    expect(verifyLoginPin('GERENTE', '7700')).toBe(true);
    expect(verifyLoginPin('ATENDENTE', '3300')).toBe(true);
  });

  it('permite PIN de login diferente por loja', () => {
    const result = changeRolePin({
      kind: 'LOGIN',
      role: 'ADMIN',
      currentPin: '9000',
      nextPin: '5678',
      storeId: 'store-alegre'
    });

    expect(result.success).toBe(true);
    expect(verifyLoginPin('ADMIN', '5678', 'store-alegre')).toBe(true);
    expect(verifyLoginPin('ADMIN', '9000', 'store-alegre')).toBe(false);
    expect(verifyLoginPin('ADMIN', '9000', 'store-dev')).toBe(true);
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

  it('persiste balanças locais e valida testes mínimos', () => {
    const settings = readLocalPeripheralSettings();
    expect(settings.scales).toHaveLength(1);
    expect(settings.scales[0].name).toBe('Auto Atendimento');
    expect(settings.scales[0].quickLabel).toBe('Balança A');

    const scaleWithError = runScaleCommunicationTest({
      ...settings.scales[0],
      port: ''
    });

    expect(scaleWithError.status).toBe('ERRO');

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
      })
    });

    expect(saved.scale.status).toBe('ATIVO');
    expect(saved.scales).toHaveLength(2);
    expect(saved.scales[1].name).toBe('Balança da copa');
    expect(saved.scales[1].status).toBe('ATIVO');
    expect(readLocalPeripheralSettings().computerName).toBe('Caixa principal');
    expect(LOCAL_PERIPHERAL_SETTINGS_STORAGE_KEY).toBe('pdv.local.peripherals');
  });
});
