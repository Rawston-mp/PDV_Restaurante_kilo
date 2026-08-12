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

type ElectronNfcePreparationResult =
  | {
      ok: true;
      result: {
        accessKey: string;
        environment: 'HOMOLOGACAO' | 'PRODUCAO';
        serie: string;
        number: string;
        qrCodeUrl: string;
        xmlLength: number;
        signedXmlLength: number;
        digestValue: string;
        referenceId: string;
        validation: {
          errors: string[];
          warnings: string[];
        };
        preparedAt: string;
      };
    }
  | { ok: false; error?: string };

type ElectronNfcePreparationInput = {
  secureStorageId?: string;
  password?: string;
  settings?: {
    companyName?: string;
    cnpj?: string;
    stateRegistration?: string;
    cnae?: string;
    taxRegime?: string;
    addressLine1?: string;
    addressLine2?: string;
    cityUf?: string;
    uf?: string;
    cscId?: string;
    cscCode?: string;
    nfceEnvironment?: 'HOMOLOGACAO' | 'PRODUCAO';
    nfceSerie?: string;
    nfceNextNumber?: string;
  };
};

declare global {
  interface Window {
    electronAPI?: {
      testarImpressora?: (config: unknown) => void;
      imprimirCupom?: (dados: unknown) => void;
      listarImpressoras?: () => Promise<ElectronPrinterInfo[]>;
      selecionarCertificadoDigital?: (options?: { importSource?: ElectronCertificateImportSource }) => Promise<ElectronCertificateStoreResult>;
      validarCertificadoDigital?: (input: { secureStorageId?: string; password?: string }) => Promise<ElectronCertificateValidationResult>;
      prepararNfceHomologacao?: (input: ElectronNfcePreparationInput) => Promise<ElectronNfcePreparationResult>;
    };
  }
}

export {};

