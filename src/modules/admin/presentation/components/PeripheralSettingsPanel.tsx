import { useState } from 'react';

import {
  readLocalPeripheralSettings,
  runScaleCommunicationTest,
  saveLocalPeripheralSettings,
  type LocalPeripheralSettings,
  type ScalePeripheralSettings
} from '@/modules/admin/infrastructure/local/platformSettings';

const statusLabel = (status: string) => status.toLowerCase();
const scaleNameSuggestions = ['Caixa', 'Copa', 'Cozinha'];

const normalizeScaleState = (settings: LocalPeripheralSettings, scales: ScalePeripheralSettings[]): LocalPeripheralSettings => ({
  ...settings,
  scales,
  scale: scales[0]
});

export function PeripheralSettingsPanel() {
  const [settings, setSettings] = useState<LocalPeripheralSettings>(readLocalPeripheralSettings);
  const [message, setMessage] = useState<string | null>(null);

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
        name: `Balança ${nextIndex + 1}`,
        serialNumber: '',
        port: `COM${nextIndex + 1}`,
        status: 'INATIVO',
        lastTestAt: undefined,
        lastTestMessage: undefined
      };

      return normalizeScaleState(current, [...current.scales, nextScale]);
    });
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
    setMessage('Configurações locais de periféricos salvas neste computador.');
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
          <h3>Periféricos do computador</h3>
          <p className="admin-subtitle">Configuração local das balanças usadas nesta estação.</p>
        </div>
        <span>Local</span>
      </div>

      <div className="admin-config-toolbar admin-peripheral-toolbar">
        <label>
          Computador
          <input
            value={settings.computerName}
            onChange={(event) => setSettings((current) => ({ ...current, computerName: event.target.value }))}
          />
        </label>
        <button type="button" onClick={onSave}>Salvar balanças</button>
      </div>

      <section className="admin-config-section admin-peripheral-section">
        <div className="admin-config-section-title">
          <div>
            <h4>Balanças</h4>
            <p className="admin-help-text">Adicione uma ou mais balanças usadas neste computador.</p>
          </div>
          <button type="button" className="button-muted admin-add-peripheral-button" onClick={addScale}>
            + Adicionar balança
          </button>
        </div>

        <div className="admin-scale-list">
          {settings.scales.map((scale, index) => (
            <div key={scale.id} className="admin-scale-item">
              <div className="admin-scale-item-header">
                <div>
                  <strong>{scale.name || `Balança ${index + 1}`}</strong>
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
                  <div className="admin-scale-name-actions">
                    {scaleNameSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="button-muted"
                        onClick={() => updateScale(scale.id, { name: suggestion })}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
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
      </section>

      <p className="admin-help-text">
        As configurações são locais por computador. Troca de máquina exige nova configuração das balanças.
      </p>

      {message && <p className="admin-message">{message}</p>}
    </article>
  );
}
