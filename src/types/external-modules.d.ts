declare module 'qrcode' {
  type QrCodeOptions = Record<string, unknown>;

  const QRCode: {
    toString(text: string, options?: QrCodeOptions): Promise<string>;
  };

  export default QRCode;
}

declare module 'node-forge' {
  const forge: any;

  namespace forge {
    namespace pki {
      type Certificate = any;

      namespace rsa {
        type PrivateKey = any;
      }
    }
  }

  export = forge;
}
