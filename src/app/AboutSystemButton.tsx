import { useState } from 'react';

import { readPlatformOwnerSettings } from '@/modules/admin/infrastructure/local/platformSettings';

type AboutSystemButtonProps = {
  position?: 'right' | 'left';
};

export function AboutSystemButton({ position = 'right' }: AboutSystemButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [ownerSettings, setOwnerSettings] = useState(readPlatformOwnerSettings);

  const openAbout = () => {
    setOwnerSettings(readPlatformOwnerSettings());
    setIsOpen(true);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
          <section className="admin-about-panel">
            <div className="admin-about-header">
              <div>
                <p className="admin-eyebrow">Sobre</p>
                <h3>PDV Touch</h3>
              </div>
              <button type="button" className="button-muted" onClick={() => setIsOpen(false)}>Fechar</button>
            </div>
            <div className="admin-about-body">
              <strong>{ownerSettings.companyName || 'Alegre Sistemas'}</strong>
              <p>{ownerSettings.aboutText}</p>
              <span>Desenvolvedor: {ownerSettings.developerName || 'Não informado'}</span>
              <span>Tempo de atuação: {ownerSettings.yearsActive || 'Não informado'}</span>
              <span>Telefone: {ownerSettings.phone || 'Não informado'}</span>
              <span>WhatsApp: {ownerSettings.whatsapp || 'Não informado'}</span>
              <span>E-mail: {ownerSettings.email || 'Não informado'}</span>
              {ownerSettings.website && <span>Site: {ownerSettings.website}</span>}
            </div>
          </section>
        </div>
      )}

      <button
        type="button"
        className={`admin-about-floating ${position === 'left' ? 'is-left' : ''}`}
        onClick={openAbout}
      >
        Sobre
      </button>
    </>
  );
}
