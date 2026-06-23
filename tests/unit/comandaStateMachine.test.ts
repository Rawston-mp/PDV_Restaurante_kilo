import { describe, expect, it } from 'vitest';

import {
  COMANDA_STATUSES,
  ComandaStateMachineService,
  type ComandaStateSnapshot
} from '../../backend/src/domain/comandaStateMachine';

describe('ComandaStateMachineService', () => {
  it('expõe os status operacionais oficiais da comanda', () => {
    expect(COMANDA_STATUSES).toEqual([
      'ABERTA',
      'EM_USO_BALANCA',
      'PRONTA_PARA_CAIXA',
      'EM_FECHAMENTO',
      'FECHADA_ORCAMENTO',
      'FECHADA_VENDA',
      'CANCELADA',
      'ARQUIVADA'
    ]);
  });

  it('permite fechar uma comanda como venda fiscal no caixa', () => {
    const service = new ComandaStateMachineService();

    service.open('101');
    service.markEmUsoBalanca('101', 'balanca_a');
    service.transition('101', 'PRONTA_PARA_CAIXA', 'cliente_finalizou_consumo');
    service.transition('101', 'EM_FECHAMENTO', 'caixa_iniciou_fechamento');
    const comanda = service.transition('101', 'FECHADA_VENDA', 'nfce_autorizada');

    expect(comanda.status).toBe('FECHADA_VENDA');
    expect(service.getActive()).toBeNull();
  });

  it('permite fechar uma comanda como orçamento não fiscal no caixa', () => {
    const service = new ComandaStateMachineService();

    service.open('102');
    service.transition('102', 'PRONTA_PARA_CAIXA', 'sem_pesagem');
    service.transition('102', 'EM_FECHAMENTO', 'caixa_iniciou_fechamento');
    const comanda = service.transition('102', 'FECHADA_ORCAMENTO', 'orcamento_nao_fiscal');

    expect(comanda.status).toBe('FECHADA_ORCAMENTO');
    expect(service.getActive()).toBeNull();
  });

  it('fecha várias comandas de forma atômica no mesmo pagamento', () => {
    const service = new ComandaStateMachineService();

    service.open('110');
    service.markEmUsoBalanca('110');
    service.open('111');

    const closed = service.closeMany(['110', '111'], 'FECHADA_VENDA', 'pagamento_conjunto');

    expect(closed.map((comanda) => comanda.status)).toEqual(['FECHADA_VENDA', 'FECHADA_VENDA']);
    expect(service.get('110')?.status).toBe('FECHADA_VENDA');
    expect(service.get('111')?.status).toBe('FECHADA_VENDA');
  });

  it('não fecha nenhuma comanda do grupo quando uma delas é inválida', () => {
    const service = new ComandaStateMachineService();

    service.open('112');
    service.open('113');
    service.transition('113', 'CANCELADA', 'cancelamento_teste');

    expect(() => service.closeMany(['112', '113'], 'FECHADA_VENDA')).toThrow(
      'Comanda #113 em status CANCELADA não pode ser fechada como FECHADA_VENDA.'
    );
    expect(service.get('112')?.status).toBe('ABERTA');
  });

  it('permite cancelar uma comanda aberta e impede nova pesagem após cancelamento', () => {
    const service = new ComandaStateMachineService();

    service.open('103');
    service.transition('103', 'CANCELADA', 'cancelamento_autorizado');

    expect(() => service.markEmUsoBalanca('103', 'balanca_a')).toThrow(
      'Comanda em status CANCELADA não aceita pesagem.'
    );
    expect(service.getActive()).toBeNull();
  });

  it('normaliza snapshots antigos para os novos status', () => {
    const service = new ComandaStateMachineService();
    const legacySnapshot: ComandaStateSnapshot = {
      activeComandaNumero: '104',
      updatedAt: '2026-06-10T00:00:00.000Z',
      comandas: [
        {
          numero: '104',
          status: 'PESAGEM_EM_ANDAMENTO' as never,
          createdAt: '2026-06-10T00:00:00.000Z',
          updatedAt: '2026-06-10T00:00:00.000Z',
          lock: null,
          items: [],
          pesagens: [],
          transitions: [
            {
              from: 'ABERTA',
              to: 'PESAGEM_EM_ANDAMENTO' as never,
              at: '2026-06-10T00:00:00.000Z'
            }
          ]
        }
      ]
    };

    service.loadSnapshot(legacySnapshot);

    expect(service.get('104')?.status).toBe('EM_USO_BALANCA');
    expect(service.getActive()?.status).toBe('EM_USO_BALANCA');
    expect(service.get('104')?.transitions[0]?.to).toBe('EM_USO_BALANCA');
  });

  it('adquire lock para uma balança e bloqueia lock concorrente', () => {
    const service = new ComandaStateMachineService();

    service.open('201');
    const acquired = service.acquireLock('201', {
      owner: 'COMANDA_A',
      stationId: 'BALANCA_A'
    });

    expect(acquired.lock.owner).toBe('COMANDA_A');
    expect(acquired.lock.stationId).toBe('BALANCA_A');

    expect(() =>
      service.acquireLock('201', {
        owner: 'COMANDA_B',
        stationId: 'BALANCA_B'
      })
    ).toThrow('Comanda já está em uso por outra balança.');
  });

  it('renova e libera lock para o mesmo owner/estacao', () => {
    const service = new ComandaStateMachineService();

    service.open('202');
    const acquired = service.acquireLock('202', {
      owner: 'COMANDA_A',
      stationId: 'BALANCA_A'
    });

    const renewed = service.renewLock('202', {
      owner: 'COMANDA_A',
      stationId: 'BALANCA_A'
    });

    expect(Date.parse(renewed.lock.expiresAt)).toBeGreaterThanOrEqual(Date.parse(acquired.lock.expiresAt));

    const released = service.releaseLock('202', {
      owner: 'COMANDA_A',
      stationId: 'BALANCA_A'
    });

    expect(released.lock).toBeNull();
  });

  it('impede liberar lock por estacao diferente', () => {
    const service = new ComandaStateMachineService();

    service.open('203');
    service.acquireLock('203', {
      owner: 'COMANDA_A',
      stationId: 'BALANCA_A'
    });

    expect(() =>
      service.releaseLock('203', {
        owner: 'COMANDA_B',
        stationId: 'BALANCA_B'
      })
    ).toThrow('Lock da comanda pertence a outra estacao.');
  });
  it('persiste itens da comanda no snapshot backend', () => {
    const service = new ComandaStateMachineService();

    service.open('301');
    service.setItems('301', [
      {
        id: 'item-1',
        nome: 'SELF SERVICE',
        precoUnitario: 59.9,
        quantidade: 0.452,
        peso: 0.452,
        categoriaId: 'Por quilo',
        subtotal: 27.07,
        porUnidade: false
      }
    ]);

    const snapshot = service.snapshot();
    const comanda = snapshot.comandas.find((record) => record.numero === '301');

    expect(comanda?.items).toHaveLength(1);
    expect(comanda?.items[0]).toMatchObject({
      id: 'item-1',
      nome: 'SELF SERVICE',
      peso: 0.452,
      subtotal: 27.07
    });
  });

  it('registra pesagem vinculada ao item e coloca a comanda em uso na balança', () => {
    const service = new ComandaStateMachineService();

    service.open('302');
    const result = service.recordPesagem('302', {
      peso: 0.452,
      origem: 'sensor',
      owner: 'COMANDA_A',
      stationId: 'BALANCA_A',
      itemId: 'item-1',
      productName: 'SELF SERVICE',
      reason: 'item_lancado'
    });

    expect(result.comanda.status).toBe('EM_USO_BALANCA');
    expect(result.comanda.pesagens).toHaveLength(1);
    expect(result.pesagem).toMatchObject({
      peso: 0.452,
      origem: 'sensor',
      owner: 'COMANDA_A',
      stationId: 'BALANCA_A',
      itemId: 'item-1'
    });
  });
});
