/// <reference types="vite/client" />

type ElectronPrinterInfo = {
  name: string;
  displayName?: string;
  description?: string;
  isDefault?: boolean;
  status?: number;
};

type ElectronCertificateImportSource = 'MAQUINA' | 'PENDRIVE';

type ElectronStoredCertificateMetadata = {
  secureStorageId: string;
  fileName: string;
  fileExtension: string;
  fileSize: number;
  importSource: ElectronCertificateImportSource;
  importedAt: string;
  hasSecureCertificate: true;
};

type ElectronCertificateStoreResult =
  | { ok: true; metadata: ElectronStoredCertificateMetadata }
  | { ok: false; canceled?: boolean; error?: string };

type ElectronCertificateValidationResult =
  | {
      ok: true;
      result: {
        fileName: string;
        fileSize: number;
        importedAt: string | null;
        sha256: string | null;
        validatedAt: string;
      };
    }
  | { ok: false; error?: string };

declare global {
  interface Window {
    electronAPI?: {
      testarImpressora?: (config: unknown) => void;
      imprimirCupom?: (dados: unknown) => void;
      listarImpressoras?: () => Promise<ElectronPrinterInfo[]>;
      selecionarCertificadoDigital?: (options?: { importSource?: ElectronCertificateImportSource }) => Promise<ElectronCertificateStoreResult>;
      validarCertificadoDigital?: (input: { secureStorageId?: string; password?: string }) => Promise<ElectronCertificateValidationResult>;
    };
  }
}

export {};

