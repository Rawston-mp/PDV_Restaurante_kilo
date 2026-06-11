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

  it('permite cancelar uma comanda aberta e impede nova pesagem após cancelamento', () => {
    const service = new ComandaStateMachineService();

    service.open('103');
    service.transition('103', 'CANCELADA', 'cancelamento_autorizado');

    expect(() => service.markEmUsoBalanca('103', 'balanca_a')).toThrow(
      'Comanda em status CANCELADA nao aceita pesagem.'
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
});
