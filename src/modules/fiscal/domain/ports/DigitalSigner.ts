export interface SignatureResult {
  signedXml: string;
  digestValue: string;
  signatureValue: string;
}

export interface DigitalSigner {
  /**
   * Assina um XML NFC-e com certificado A1 (PFX/P12)
   * @param xml XML a ser assinado (sem assinatura)
   * @param certificatePath Caminho do arquivo .pfx/.p12
   * @param certificatePassword Senha do certificado (deve vir de armazenamento seguro)
   */
  signNfceXml(xml: string, certificatePath: string, certificatePassword: string): Promise<SignatureResult>;

  /**
   * Valida se o certificado está dentro da validade
   * @param certificatePath Caminho do certificado
   * @param certificatePassword Senha do certificado
   */
  validateCertificate(certificatePath: string, certificatePassword: string): Promise<{
    isValid: boolean;
    expirationDate: Date;
    subject: string;
    error?: string;
  }>;
}
