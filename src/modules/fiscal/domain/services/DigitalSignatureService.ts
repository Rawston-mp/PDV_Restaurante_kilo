import type { DigitalSigner, SignatureResult } from '../ports/DigitalSigner';
import * as forge from 'node-forge';
import * as fs from 'fs/promises';

/**
 * DigitalSignatureService
 * 
 * Responsável por assinar XML NFC-e com certificado A1 (PFX/P12) usando node-forge.
 * 
 * Segurança:
 * - Nunca armazena senha do certificado em memória de longo prazo.
 * - Valida expiração antes de assinar.
 * - Usa SHA-256 + RSA (padrão SEFAZ).
 */
export class DigitalSignatureService implements DigitalSigner {
  async signNfceXml(
    xml: string,
    certificatePath: string,
    certificatePassword: string
  ): Promise<SignatureResult> {
    try {
      // 1. Ler arquivo PFX
      const pfxBuffer = await fs.readFile(certificatePath);
      const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'));

      // 2. Descriptografar PFX com senha
      const pfx = forge.pkcs12.pkcs12FromAsn1(
        forge.asn1.fromDer(pfxDer),
        false,
        certificatePassword
      );

      // 3. Extrair chave privada e certificado
      const bags = pfx.getBags({
        bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
      });
      const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

      if (!keyBag || !keyBag.key) {
        throw new Error('Chave privada não encontrada no certificado');
      }

      const privateKey = keyBag.key as forge.pki.rsa.PrivateKey;

      // Extrair certificado
      const certBags = pfx.getBags({
        bagType: forge.pki.oids.certBag,
      });
      const certBag = certBags[forge.pki.oids.certBag]?.[0];

      if (!certBag || !certBag.cert) {
        throw new Error('Certificado não encontrado no PFX');
      }

      const certificate = certBag.cert as forge.pki.Certificate;

      // 4. Validar expiração
      const now = new Date();
      if (now < certificate.validity.notBefore || now > certificate.validity.notAfter) {
        throw new Error('Certificado expirado ou ainda não válido');
      }

      // 5. Canonicalizar XML (abordagem simplificada para NFC-e)
      // Remove quebras de linha e espaços desnecessários entre tags
      const canonicalXml = this.canonicalizeXml(xml);

      // 6. Gerar digest SHA-256 do XML canonicalizado
      const md = forge.md.sha256.create();
      md.update(canonicalXml, 'utf8');
      const digestValue = forge.util.encode64(md.digest().getBytes());

      // 7. Assinar o digest com RSA + SHA-256
      const signature = privateKey.sign(md, 'RSASSA-PKCS1-V1_5');
      const signatureValue = forge.util.encode64(signature);

      // 8. Montar tag <Signature> (XMLDSig)
      const signatureXml = this.buildSignatureXml(
        digestValue,
        signatureValue,
        certificate
      );

      // 9. Inserir assinatura no XML (antes de </NFe> ou no final do infNFe)
      const signedXml = this.insertSignature(xml, signatureXml);

      return {
        signedXml,
        digestValue,
        signatureValue,
      };
    } catch (error: any) {
      throw new Error(`Erro ao assinar XML: ${error.message}`);
    }
  }

  async validateCertificate(
    certificatePath: string,
    certificatePassword: string
  ): Promise<{
    isValid: boolean;
    expirationDate: Date;
    subject: string;
    error?: string;
  }> {
    try {
      const pfxBuffer = await fs.readFile(certificatePath);
      const pfxDer = forge.util.createBuffer(pfxBuffer.toString('binary'));

      const pfx = forge.pkcs12.pkcs12FromAsn1(
        forge.asn1.fromDer(pfxDer),
        false,
        certificatePassword
      );

      const certBags = pfx.getBags({
        bagType: forge.pki.oids.certBag,
      });
      const certBag = certBags[forge.pki.oids.certBag]?.[0];

      if (!certBag || !certBag.cert) {
        return {
          isValid: false,
          expirationDate: new Date(0),
          subject: '',
          error: 'Certificado não encontrado no PFX',
        };
      }

      const certificate = certBag.cert as forge.pki.Certificate;
      const now = new Date();
      const isValid = now >= certificate.validity.notBefore && now <= certificate.validity.notAfter;

      return {
        isValid,
        expirationDate: certificate.validity.notAfter,
        subject: certificate.subject.getField('CN')?.value || 'CN=Desconhecido',
        error: isValid ? undefined : 'Certificado expirado ou inválido',
      };
    } catch (err: any) {
      return {
        isValid: false,
        expirationDate: new Date(0),
        subject: '',
        error: err.message || 'Erro ao validar certificado',
      };
    }
  }

  /**
   * Canonicalização simplificada do XML (remove formatação desnecessária)
   */
  private canonicalizeXml(xml: string): string {
    return xml
      .replace(/>\s+</g, '><') // Remove whitespace entre tags
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
  }

  /**
   * Monta a estrutura <Signature> conforme XMLDSig + padrão SEFAZ
   */
  private buildSignatureXml(
    digestValue: string,
    signatureValue: string,
    certificate: forge.pki.Certificate
  ): string {
    // Extrai o certificado em Base64 (sem cabeçalhos PEM)
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
    const certB64 = forge.util.encode64(certDer);

    // Quebra o certificado em linhas de 76 caracteres (padrão PEM)
    const certLines = certB64.match(/.{1,76}/g)?.join('\n') || certB64;

    return `
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
  <SignedInfo>
    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha256"/>
    <Reference URI="#NFe${this.extractAccessKeyFromXml('')}">
      <Transforms>
        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      </Transforms>
      <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <DigestValue>${digestValue}</DigestValue>
    </Reference>
  </SignedInfo>
  <SignatureValue>${signatureValue}</SignatureValue>
  <KeyInfo>
    <X509Data>
      <X509Certificate>
${certLines}
      </X509Certificate>
    </X509Data>
  </KeyInfo>
</Signature>`;
  }

  /**
   * Insere a tag <Signature> no XML da NFC-e
   */
  private insertSignature(xml: string, signatureXml: string): string {
    // Insere antes de </NFe>
    if (xml.includes('</NFe>')) {
      return xml.replace('</NFe>', `${signatureXml}\n</NFe>`);
    }
    // Fallback: insere no final
    return xml + signatureXml;
  }

  /**
   * Extrai a chave de acesso do XML (helper)
   */
  private extractAccessKeyFromXml(xml: string): string {
    // Em implementação real, extrairia do atributo Id da tag infNFe
    // Por enquanto retorna string vazia (será preenchido pelo caller)
    return '';
  }
}
