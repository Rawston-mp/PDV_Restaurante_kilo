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

      // 5. Extrair <infNFe> e seu Id (Id="NFe..." contém a chave de acesso)
      const infNFeMatch = xml.match(/<infNFe\s+([^>]*)>([\s\S]*?)<\/infNFe>/i);
      if (!infNFeMatch) {
        throw new Error('Tag <infNFe> não encontrada no XML');
      }

      const infNFeAttrs = infNFeMatch[1];
      const infNFeInner = `<infNFe ${infNFeAttrs}>${infNFeMatch[2]}</infNFe>`;

      // 6. Extrair accessKey (parte do atributo Id="NFeXXXXXXXX...)
      const accessKey = this.extractAccessKeyFromXml(infNFeInner);
      if (!accessKey) {
        throw new Error('Chave de acesso não encontrada no infNFe');
      }

      // 7. Canonicalizar apenas o infNFe (C14N simplificado compatível)
      const canonicalInfNFe = this.canonicalizeXml(infNFeInner);

      // 8. Calcular digest SHA-256 sobre o infNFe canonicalizado
      const mdInf = forge.md.sha256.create();
      mdInf.update(canonicalInfNFe, 'utf8');
      const digestValue = forge.util.encode64(mdInf.digest().getBytes());

      // 9. Montar SignedInfo com Reference para o Id extraído
      const signedInfo = `<?xml version="1.0"?>\n<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">\n  <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>\n  <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>\n  <Reference URI="#${accessKey}">\n    <Transforms>\n      <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>\n      <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>\n    </Transforms>\n    <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>\n    <DigestValue>${digestValue}</DigestValue>\n  </Reference>\n</SignedInfo>`;

      const canonicalSignedInfo = this.canonicalizeXml(signedInfo);

      // 10. Assinar o SignedInfo (RSA-SHA256) e gerar SignatureValue
      const mdSignedInfo = forge.md.sha256.create();
      mdSignedInfo.update(canonicalSignedInfo, 'utf8');
      const signatureBytes = privateKey.sign(mdSignedInfo);
      const signatureValue = forge.util.encode64(signatureBytes);

      // 11. Montar tag <Signature> com certificado e SignatureValue
      const signatureXml = this.buildSignatureXmlForAccessKey(
        accessKey,
        digestValue,
        signatureValue,
        certificate,
        canonicalSignedInfo
      );

      // 12. Inserir assinatura no XML (antes de </NFe>)
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
    // Remover declaração XML
    const noDecl = xml.replace(/<\?xml[^>]*\?>/g, '');
    // Remover espaços entre tags, preservar espaços dentro de texto
    const collapsed = noDecl.replace(/>\s+</g, '><');
    // Remover espaços repetidos fora de tags
    return collapsed.replace(/\s+/g, ' ').trim();
  }

  /**
   * Monta a estrutura <Signature> conforme XMLDSig + padrão SEFAZ
   */
  private buildSignatureXmlForAccessKey(
    accessKey: string,
    digestValue: string,
    signatureValue: string,
    certificate: forge.pki.Certificate,
    signedInfoCanonicalized: string
  ): string {
    // Extrai o certificado em Base64 (sem cabeçalhos PEM)
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
    const certB64 = forge.util.encode64(certDer);

    // Quebra o certificado em linhas de 76 caracteres (padrão PEM)
    const certLines = certB64.match(/.{1,76}/g)?.join('\n') || certB64;

    // Note: SignedInfo element must be canonicalized before signing; caller provided canonicalized SignedInfo
    return `\n<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">\n  ${signedInfoCanonicalized.replace(/^<\?xml[^>]*\?>/, '')}\n  <SignatureValue>${signatureValue}</SignatureValue>\n  <KeyInfo>\n    <X509Data>\n      <X509Certificate>\n${certLines}\n      </X509Certificate>\n    </X509Data>\n  </KeyInfo>\n</Signature>`;
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
    // Procura atributo Id="NFe{chave}" dentro da tag <infNFe>
    const idMatch = xml.match(/<infNFe\s+[^>]*Id\s*=\s*"NFe(\d{44})"/i);
    if (idMatch) return idMatch[1];

    // Alternativa: procurar chNFe em outros locais
    const chMatch = xml.match(/<chNFe>(\d{44})<\/chNFe>/i);
    if (chMatch) return chMatch[1];

    return '';
  }
}
