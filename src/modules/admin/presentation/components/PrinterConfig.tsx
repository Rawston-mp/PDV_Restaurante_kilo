import { useEffect, useMemo, useState } from 'react';

type TipoConexao = 'USB' | 'REDE' | 'SERIAL';
type LarguraBobina = 80 | 58;
type PrinterProfileId = 'CAIXA' | 'COPA' | 'COZINHA';

export type PrinterConfigState = {
  tipoConexao: TipoConexao;
  caminhoPorta: string;
  portaTcp: number;
  colunas: number;
  corteAutomatico: boolean;
  larguraBobina: LarguraBobina;
};

type PrinterProfile = {
  id: PrinterProfileId;
  label: string;
  description: string;
  customName: string;
  purpose: string;
  config: PrinterConfigState;
};

type PrinterProfileMeta = Pick<PrinterProfile, 'id' | 'label' | 'description'>;

type InstalledPrinter = {
  name: string;
  displayName?: string;
  description?: string;
  isDefault?: boolean;
  status?: number;
};

declare global {
  interface Window {
    electronAPI?: {
      testarImpressora?: (config: PrinterConfigState) => void;
      imprimirCupom?: (dados: unknown) => void;
      listarImpressoras?: () => Promise<InstalledPrinter[]>;
    };
  }
}

const STORAGE_KEY = 'pdv.printer.thermal.configs';
const LEGACY_STORAGE_KEY = 'pdv.printer.thermal.config';

const defaultConfig: PrinterConfigState = {
  tipoConexao: 'USB',
  caminhoPorta: 'USB001',
  portaTcp: 9100,
  colunas: 48,
  corteAutomatico: true,
  larguraBobina: 80
};

const printerProfileMeta: PrinterProfileMeta[] = [
  { id: 'CAIXA', label: 'Caixa', description: 'Cupom do caixa e NFC-e' },
  { id: 'COPA', label: 'Copa', description: 'Pedidos e preparo da copa' },
  { id: 'COZINHA', label: 'Cozinha', description: 'Pedidos de cozinha' }
];

const connectionOptions: TipoConexao[] = ['USB', 'REDE', 'SERIAL'];
const paperOptions: LarguraBobina[] = [80, 58];

function createDefaultProfiles(): PrinterProfile[] {
  return printerProfileMeta.map((profile, index) => ({
    ...profile,
    customName: profile.label,
    purpose: profile.description,
    config: {
      ...defaultConfig,
      caminhoPorta: index === 0 ? 'USB001' : '',
      tipoConexao: index === 0 ? 'USB' : 'REDE'
    }
  }));
}

function normalizeProfiles(rawProfiles: unknown): PrinterProfile[] {
  const defaults = createDefaultProfiles();
  const source = Array.isArray(rawProfiles) ? rawProfiles as Array<Partial<PrinterProfile>> : [];

  return defaults.map((profile) => {
    const stored = source.find((item) => item.id === profile.id);
    return {
      ...profile,
      customName: String(stored?.customName || profile.customName),
      purpose: String(stored?.purpose || profile.purpose),
      config: {
        ...profile.config,
        ...(stored?.config ?? {})
      }
    };
  });
}

function readStoredProfiles(): PrinterProfile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return normalizeProfiles(JSON.parse(stored));
    }

    const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyStored) {
      const [firstProfile, ...rest] = createDefaultProfiles();
      return [
        {
          ...firstProfile,
          config: {
            ...firstProfile.config,
            ...JSON.parse(legacyStored)
          }
        },
        ...rest
      ];
    }

    return createDefaultProfiles();
  } catch {
    return createDefaultProfiles();
  }
}

export function PrinterConfig() {
  const [profiles, setProfiles] = useState<PrinterProfile[]>(createDefaultProfiles);
  const [selectedProfileId, setSelectedProfileId] = useState<PrinterProfileId>('CAIXA');
  const [, setFeedback] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [printers, setPrinters] = useState<InstalledPrinter[]>([]);
  const [printerQuery, setPrinterQuery] = useState('');
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);

  useEffect(() => {
    setProfiles(readStoredProfiles());
  }, []);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0];
  const config = selectedProfile.config;

  const filteredPrinters = useMemo(() => {
    const query = printerQuery.trim().toLowerCase();
    if (!query) {
      return printers;
    }

    return printers.filter((printer) => (
      printer.name.toLowerCase().includes(query)
      || printer.displayName?.toLowerCase().includes(query)
      || printer.description?.toLowerCase().includes(query)
    ));
  }, [printerQuery, printers]);

  const updateConfig = (patch: Partial<PrinterConfigState>) => {
    setProfiles((current) => current.map((profile) => (
      profile.id === selectedProfileId
        ? {
            ...profile,
            config: {
              ...profile.config,
              ...patch
            }
          }
        : profile
    )));
  };

  const updateSelectedProfile = (patch: Partial<Pick<PrinterProfile, 'customName' | 'purpose'>>) => {
    setProfiles((current) => current.map((profile) => (
      profile.id === selectedProfileId
        ? {
            ...profile,
            ...patch
          }
        : profile
    )));
  };

  const onSelectPaper = (larguraBobina: LarguraBobina) => {
    updateConfig({
      larguraBobina,
      colunas: larguraBobina === 80 ? 48 : 32
    });
  };

  const handleSalvar = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    setFeedback(`Configuração da impressora ${selectedProfile.customName || selectedProfile.label} salva neste computador.`);
    setIsOpen(false);
  };

  const handleTestar = () => {
    if (window.electronAPI?.testarImpressora) {
      window.electronAPI.testarImpressora(config);
      setFeedback(`Teste enviado para a impressora ${selectedProfile.customName || selectedProfile.label}.`);
      return;
    }

    setFeedback('Teste simulado. A ponte Electron não está disponível neste ambiente.');
  };

  const handleBuscarImpressoras = async () => {
    if (!window.electronAPI?.listarImpressoras) {
      setFeedback('Busca de impressoras disponível apenas no aplicativo Electron.');
      return;
    }

    setIsLoadingPrinters(true);
    try {
      const installedPrinters = await window.electronAPI.listarImpressoras();
      setPrinters(installedPrinters);
      setFeedback(installedPrinters.length > 0
        ? `${installedPrinters.length} impressora(s) encontrada(s).`
        : 'Nenhuma impressora instalada foi encontrada.');
    } catch {
      setFeedback('Não foi possível buscar impressoras instaladas nesta máquina.');
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  const selectPrinter = (printerName: string) => {
    updateConfig({
      tipoConexao: 'USB',
      caminhoPorta: printerName
    });
    setPrinterQuery(printerName);
  };

  const handleSelectProfile = (profileId: PrinterProfileId) => {
    setSelectedProfileId(profileId);
    setPrinterQuery('');
  };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>+ Adicionar Impressora</button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
          <section className="w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-y-auto bg-slate-900 text-slate-100 rounded-2xl border border-slate-700 shadow-2xl">
            <div className="sticky top-0 z-10 bg-slate-800 px-4 py-4 border-b border-slate-700 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-400 font-bold">Periféricos</p>
                <h3 className="text-xl font-extrabold text-white">Configuração de impressora de recibos</h3>
                <p className="text-sm text-slate-400">Selecione Caixa, Copa ou Cozinha e configure a impressora correspondente.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-14 min-w-28 rounded-xl bg-slate-700 border border-slate-600 text-white font-black hover:bg-slate-600 touch-manipulation"
              >
                Fechar
              </button>
            </div>

            <div className="p-4 border-b border-slate-700 bg-slate-900">
              <label className="block text-sm font-bold text-slate-200 mb-2">Qual impressora deseja configurar?</label>
              <select
                value={selectedProfileId}
                onChange={(event) => handleSelectProfile(event.target.value as PrinterProfileId)}
                className="w-full h-14 rounded-xl bg-slate-950 border border-slate-600 px-4 text-lg font-bold text-amber-300 outline-none focus:border-amber-400"
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.customName || profile.label} - {profile.purpose || profile.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-b border-slate-700 bg-slate-900">
              <label className="block">
                <span className="block text-sm font-bold text-slate-200 mb-2">Nome da impressora</span>
                <input
                  type="text"
                  value={selectedProfile.customName}
                  onChange={(event) => updateSelectedProfile({ customName: event.target.value })}
                  placeholder="Ex.: Caixa principal, Epson L455, Relatórios A4"
                  className="w-full h-14 rounded-xl bg-slate-950 border border-slate-600 px-4 text-lg font-bold text-amber-300 outline-none focus:border-amber-400"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-bold text-slate-200 mb-2">Finalidade</span>
                <input
                  type="text"
                  value={selectedProfile.purpose}
                  onChange={(event) => updateSelectedProfile({ purpose: event.target.value })}
                  placeholder="Ex.: Cupom NFC-e, relatórios A4, pedidos da cozinha"
                  className="w-full h-14 rounded-xl bg-slate-950 border border-slate-600 px-4 text-lg text-slate-100 outline-none focus:border-amber-400"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.15fr] gap-4 p-4">
              <section className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-200 mb-2">Tipo de conexão</label>
                  <div className="grid grid-cols-3 gap-2">
                    {connectionOptions.map((tipoConexao) => (
                      <button
                        key={tipoConexao}
                        type="button"
                        onClick={() => updateConfig({ tipoConexao })}
                        className={`h-14 rounded-xl border text-sm font-black tracking-wide transition touch-manipulation ${
                          config.tipoConexao === tipoConexao
                            ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/25'
                            : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
                        }`}
                      >
                        {tipoConexao}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-200 mb-2">Largura da bobina</label>
                  <div className="grid grid-cols-2 gap-2">
                    {paperOptions.map((larguraBobina) => (
                      <button
                        key={larguraBobina}
                        type="button"
                        onClick={() => onSelectPaper(larguraBobina)}
                        className={`h-14 rounded-xl border font-black transition touch-manipulation ${
                          config.larguraBobina === larguraBobina
                            ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/25'
                            : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
                        }`}
                      >
                        <span className="block">{larguraBobina} mm</span>
                        <span className="block text-[11px] opacity-80">
                          {larguraBobina === 80 ? '48 colunas' : '32 colunas'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateConfig({ corteAutomatico: !config.corteAutomatico })}
                  className={`w-full h-14 rounded-xl border px-4 flex items-center justify-between font-bold transition touch-manipulation ${
                    config.corteAutomatico
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-200'
                  }`}
                >
                  <span>Corte automático</span>
                  <span>{config.corteAutomatico ? 'Ativo' : 'Inativo'}</span>
                </button>
              </section>

              <section className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <label className="block">
                    <span className="block text-sm font-bold text-slate-200 mb-2">Buscar impressora instalada</span>
                    <input
                      type="search"
                      value={printerQuery}
                      onChange={(event) => setPrinterQuery(event.target.value)}
                      placeholder="Digite Epson, Elgin, Daruma, PDF..."
                      className="w-full h-14 rounded-xl bg-slate-950 border border-slate-600 px-4 text-lg text-slate-100 outline-none focus:border-amber-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleBuscarImpressoras()}
                    className="h-14 self-end rounded-xl bg-slate-700 border border-slate-600 px-5 text-white font-black hover:bg-slate-600 touch-manipulation"
                  >
                    {isLoadingPrinters ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>

                {filteredPrinters.length > 0 && (
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/70 p-2 space-y-2">
                    {filteredPrinters.map((printer) => (
                      <button
                        key={printer.name}
                        type="button"
                        onClick={() => selectPrinter(printer.name)}
                        className={`w-full min-h-14 rounded-lg border px-3 py-2 text-left transition touch-manipulation ${
                          config.caminhoPorta === printer.name
                            ? 'bg-amber-500 border-amber-300 text-slate-950'
                            : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
                        }`}
                      >
                        <strong className="block">{printer.displayName || printer.name}</strong>
                        <span className="block text-xs opacity-75">
                          {printer.isDefault ? 'Padrão do sistema' : 'Instalada'}{printer.description ? ` · ${printer.description}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {config.tipoConexao === 'REDE' ? (
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_9rem] gap-3">
                    <label className="block">
                      <span className="block text-sm font-bold text-slate-200 mb-2">IP da impressora</span>
                      <input
                        type="text"
                        value={config.caminhoPorta}
                        onChange={(event) => updateConfig({ caminhoPorta: event.target.value })}
                        placeholder="192.168.1.100"
                        className="w-full h-14 rounded-xl bg-slate-950 border border-slate-600 px-4 text-lg font-mono text-amber-300 outline-none focus:border-amber-400"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-sm font-bold text-slate-200 mb-2">Porta TCP</span>
                      <input
                        type="number"
                        value={config.portaTcp}
                        onChange={(event) => updateConfig({ portaTcp: Number(event.target.value) || 9100 })}
                        className="w-full h-14 rounded-xl bg-slate-950 border border-slate-600 px-4 text-lg font-mono text-amber-300 outline-none focus:border-amber-400"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="block">
                    <span className="block text-sm font-bold text-slate-200 mb-2">
                      Caminho, driver ou porta local ({config.tipoConexao})
                    </span>
                    <input
                      type="text"
                      value={config.caminhoPorta}
                      onChange={(event) => updateConfig({ caminhoPorta: event.target.value })}
                      placeholder={config.tipoConexao === 'USB' ? 'Nome da impressora instalada' : 'COM1'}
                      className="w-full h-14 rounded-xl bg-slate-950 border border-slate-600 px-4 text-lg font-mono text-amber-300 outline-none focus:border-amber-400"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="block text-sm font-bold text-slate-200 mb-2">Colunas por linha</span>
                  <input
                    type="number"
                    min={24}
                    max={64}
                    value={config.colunas}
                    onChange={(event) => updateConfig({ colunas: Number(event.target.value) || 48 })}
                    className="w-full h-14 rounded-xl bg-slate-950 border border-slate-600 px-4 text-lg font-mono text-amber-300 outline-none focus:border-amber-400"
                  />
                </label>

                <div className="rounded-xl bg-slate-950/70 border border-slate-700 p-3 text-xs leading-relaxed text-slate-400">
                  A busca usa as impressoras instaladas no sistema operacional via Electron. Para impressora de rede, use IP fixo e porta 9100.
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-t border-slate-700 bg-slate-950/95">
              <button
                type="button"
                onClick={handleTestar}
                className="h-14 rounded-xl bg-slate-700 border border-slate-600 text-white font-black tracking-wide hover:bg-slate-600 active:bg-slate-500 touch-manipulation"
              >
                Testar impressão
              </button>

              <button
                type="button"
                onClick={handleSalvar}
                className="h-14 rounded-xl bg-emerald-600 border border-emerald-500 text-white font-black tracking-wide hover:bg-emerald-500 active:bg-emerald-700 touch-manipulation"
              >
                Salvar configurações
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
