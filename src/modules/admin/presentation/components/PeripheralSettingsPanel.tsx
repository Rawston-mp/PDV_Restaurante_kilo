import { useState } from 'react';

import {
  readLocalPeripheralSettings,
  runScaleCommunicationTest,
  saveLocalPeripheralSettings,
  type LocalPeripheralSettings,
  type ScalePeripheralSettings
} from '@/modules/admin/infrastructure/local/platformSettings';
import { PrinterConfig } from '@/modules/admin/presentation/components/PrinterConfig';

const statusLabel = (status: string) => status.toLowerCase();
const scaleNameSuggestions = ['Balança A', 'Balança B'];

const normalizeScaleState = (settings: LocalPeripheralSettings, scales: ScalePeripheralSettings[]): LocalPeripheralSettings => ({
  ...settings,
  scales,
  scale: scales[0]
});

type PeripheralSettingsPanelProps = {
  onOpenFiscalSettings?: () => void;
};

export function PeripheralSettingsPanel({ onOpenFiscalSettings }: PeripheralSettingsPanelProps) {
  const [settings, setSettings] = useState<LocalPeripheralSettings>(readLocalPeripheralSettings);
  const [message, setMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const updateScale = (scaleId: string, patch: Partial<ScalePeripheralSettings>) => {
    setSettings((current) => {
      const scales = current.scales.map((scale) => (
        scale.id === scaleId
          ? {
              ...scale,
              ...patch
            }
          : scale
      ));

      return normalizeScaleState(current, scales);
    });
  };

  const addScale = () => {
    setSettings((current) => {
      const nextIndex = current.scales.length;
      const baseScale = current.scales[0] ?? current.scale;
      const nextScale: ScalePeripheralSettings = {
        ...baseScale,
        id: `scale-${Date.now()}-${nextIndex + 1}`,
        name: nextIndex === 0 ? 'Auto Atendimento' : nextIndex === 1 ? 'Copa' : `Local ${nextIndex + 1}`,
        quickLabel: nextIndex === 0 ? 'Balança A' : 'Balança B',
        serialNumber: '',
        port: `COM${nextIndex + 1}`,
        status: 'INATIVO',
        lastTestAt: undefined,
        lastTestMessage: undefined
      };

      return normalizeScaleState(current, [...current.scales, nextScale]);
    });
  };

  const openScaleConfig = () => {
    setIsOpen(true);
  };

  const removeScale = (scaleId: string) => {
    setSettings((current) => {
      if (current.scales.length <= 1) {
        return current;
      }

      const scales = current.scales.filter((scale) => scale.id !== scaleId);
      return normalizeScaleState(current, scales);
    });
  };

  const onSave = () => {
    const saved = saveLocalPeripheralSettings(settings);
    setSettings(saved);
    setMessage('Configurações locais de balanças salvas neste computador.');
    setIsOpen(false);
  };

  const onTestScale = (scaleId: string) => {
    setSettings((current) => {
      const scales = current.scales.map((scale) => (
        scale.id === scaleId ? runScaleCommunicationTest(scale) : scale
      ));

      return normalizeScaleState(current, scales);
    });
  };

  return (
    <article className="card admin-config-card admin-peripheral-card">
      <div className="admin-config-header">
        <div>
          <h3>Configurações gerais</h3>
          <p className="admin-subtitle">Ajuste impressoras, balanças e NFC-e deste computador.</p>
        </div>
        <span>Local</span>
      </div>

      <div className="admin-config-toolbar admin-peripheral-toolbar">
        <PrinterConfig />
        <button type="button" onClick={openScaleConfig}>Balanças</button>
        <button type="button" onClick={onOpenFiscalSettings}>Fiscal NFC-e</button>
      </div>

      {message && <p className="admin-message">{message}</p>}

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
          <section className="w-full max-w-5xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl mx-auto">
            <div className="sticky top-0 z-10 bg-white px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="admin-eyebrow">Configurações locais</p>
                <h3>Configuração de balanças</h3>
                <p className="admin-subtitle">Adicione, renomeie e teste uma ou mais balanças deste computador.</p>
              </div>
              <button type="button" className="button-muted" onClick={() => setIsOpen(false)}>Fechar</button>
            </div>

            <div className="p-4 space-y-4">
              <div className="admin-config-toolbar admin-peripheral-toolbar">
                <button type="button" onClick={addScale}>+ Adicionar balança</button>
              </div>

              <div className="admin-scale-list">
                {settings.scales.map((scale, index) => (
                  <div key={scale.id} className="admin-scale-item">
                    <div className="admin-scale-item-header">
                      <div>
                        <strong>{scale.name || `Local ${index + 1}`}</strong>
                        <span>PRIX 3/16 via Serial RS-232</span>
                      </div>
                      <span className={`admin-status-badge is-${scale.status.toLowerCase()}`}>{statusLabel(scale.status)}</span>
                    </div>

                    <div className="admin-config-grid admin-peripheral-grid admin-scale-grid">
                      <label className="admin-inline-check">
                        <input
                          type="checkbox"
                          checked={scale.enabled}
                          onChange={(event) => updateScale(scale.id, { enabled: event.target.checked })}
                        />
                        Ativa neste computador
                      </label>
                      <label>
                        Nome
                        <input value={scale.name} onChange={(event) => updateScale(scale.id, { name: event.target.value })} />
                      </label>
                      <div className="admin-config-field">
                        <span>Apelido rápido</span>
                        <select
                          value={scale.quickLabel ?? ''}
                          onChange={(event) => updateScale(scale.id, { quickLabel: event.target.value as ScalePeripheralSettings['quickLabel'] })}
                        >
                          <option value="">Escolher apelido</option>
                          {scaleNameSuggestions.map((suggestion) => (
                            <option key={suggestion} value={suggestion}>
                              {suggestion}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label>
                        Modelo
                        <input value={scale.model} readOnly />
                      </label>
                      <label>
                        Série
                        <input value={scale.serialNumber} onChange={(event) => updateScale(scale.id, { serialNumber: event.target.value })} />
                      </label>
                      <label>
                        Comunicação
                        <input value="Serial RS-232" readOnly />
                      </label>
                      <label>
                        Porta COM
                        <input value={scale.port} onChange={(event) => updateScale(scale.id, { port: event.target.value.toUpperCase() })} placeholder="COM1" />
                      </label>
                      <label>
                        Baud rate
                        <input value={scale.baudRate} onChange={(event) => updateScale(scale.id, { baudRate: event.target.value })} inputMode="numeric" />
                      </label>
                      <label>
                        Paridade
                        <select value={scale.parity} onChange={(event) => updateScale(scale.id, { parity: event.target.value as ScalePeripheralSettings['parity'] })}>
                          <option value="NONE">Nenhuma</option>
                          <option value="EVEN">Par</option>
                          <option value="ODD">Ímpar</option>
                        </select>
                      </label>
                      <label>
                        Bits de dados
                        <input value={scale.dataBits} onChange={(event) => updateScale(scale.id, { dataBits: event.target.value })} inputMode="numeric" />
                      </label>
                      <label>
                        Stop bits
                        <input value={scale.stopBits} onChange={(event) => updateScale(scale.id, { stopBits: event.target.value })} inputMode="decimal" />
                      </label>
                      <label>
                        Timeout
                        <input value={scale.timeoutMs} onChange={(event) => updateScale(scale.id, { timeoutMs: event.target.value })} inputMode="numeric" />
                      </label>
                    </div>

                    <div className="admin-test-row admin-peripheral-test-row">
                      <button type="button" className="button-muted" onClick={() => onTestScale(scale.id)}>Testar leitura da balança</button>
                      {settings.scales.length > 1 && (
                        <button type="button" className="admin-danger" onClick={() => removeScale(scale.id)}>Remover balança</button>
                      )}
                      <span>{scale.lastTestMessage ?? 'Nenhum teste executado.'}</span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="admin-help-text">
                As configurações são locais por computador. Troca de máquina exige nova configuração das balanças.
              </p>
            </div>

            <div className="sticky bottom-0 grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-t border-slate-200 bg-white/95">
              <button type="button" className="button-muted" onClick={() => setIsOpen(false)}>Cancelar</button>
              <button type="button" onClick={onSave}>Salvar balanças</button>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}
