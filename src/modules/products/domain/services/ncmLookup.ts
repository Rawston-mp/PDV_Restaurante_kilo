export type NcmLookupItem = {
  code: string;
  description: string;
  keywords?: string[];
};

export const NCM_OFFICIAL_SOURCE_URL =
  'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO';

const ncmLookupCatalog: NcmLookupItem[] = [
  { code: '02013000', description: 'Carne bovina desossada, fresca ou refrigerada' },
  { code: '02071400', description: 'Cortes e miudezas de frango congelados' },
  { code: '03038990', description: 'Peixes congelados (outros)' },
  { code: '04012010', description: 'Leite UHT integral' },
  { code: '07031019', description: 'Cebola fresca ou refrigerada (outras)' },
  { code: '07133329', description: 'Feijão comum, seco, debulhado (outros)' },
  { code: '09012100', description: 'Café torrado, não descafeinado' },
  { code: '10063021', description: 'Arroz semibranqueado ou branqueado, polido' },
  { code: '11010010', description: 'Farinha de trigo' },
  { code: '16025000', description: 'Preparações alimentícias de carne bovina' },
  { code: '17019900', description: 'Açúcares de cana ou de beterraba (outros)' },
  { code: '19021900', description: 'Massas alimentícias não cozidas (outras)' },
  { code: '19059090', description: 'Produtos de padaria e pastelaria (outros)' },
  { code: '20057000', description: 'Azeitonas preparadas ou conservadas' },
  { code: '21039021', description: 'Molhos preparados (maionese)' },
  { code: '22011000', description: 'Água mineral e água gaseificada' },
  { code: '22021000', description: 'Refrigerantes e bebidas não alcoólicas' },
  { code: '22030000', description: 'Cervejas de malte' },
  { code: '22042100', description: 'Vinhos em recipientes de até 2 litros' },
  { code: '24011010', description: 'Tabaco não destalado, em folhas, sem secar nem fermentar', keywords: ['fumo'] },
  { code: '24011020', description: 'Tabaco não destalado, em folhas secas ou fermentadas tipo capeiro', keywords: ['fumo'] },
  { code: '24011030', description: 'Tabaco não destalado, em folhas secas em secador de ar quente, do tipo Virgínia', keywords: ['fumo'] },
  { code: '24011040', description: 'Tabaco não destalado, em folhas secas, com óleos voláteis superior a 0,2%, do tipo turco', keywords: ['fumo'] },
  { code: '24011090', description: 'Tabaco não destalado, outros', keywords: ['fumo'] },
  { code: '24012010', description: 'Tabaco total ou parcialmente destalado, em folhas, sem secar nem fermentar', keywords: ['fumo'] },
  { code: '24012020', description: 'Tabaco total ou parcialmente destalado, em folhas secas ou fermentadas tipo capeiro', keywords: ['fumo'] },
  { code: '24012030', description: 'Tabaco total ou parcialmente destalado, em folhas secas em secador de ar quente, do tipo Virgínia', keywords: ['fumo'] },
  { code: '24012040', description: 'Tabaco total ou parcialmente destalado, em folhas secas do tipo Burley', keywords: ['fumo'] },
  { code: '24012090', description: 'Tabaco total ou parcialmente destalado, outros', keywords: ['fumo'] },
  { code: '24013000', description: 'Desperdícios de tabaco', keywords: ['fumo'] },
  { code: '24021000', description: 'Charutos e cigarrilhas que contenham tabaco', keywords: ['cigarro', 'cigarrilha', 'fumo'] },
  { code: '24022000', description: 'Cigarros que contenham tabaco', keywords: ['cigarro', 'fumo', 'tabacaria'] },
  { code: '24029000', description: 'Charutos, cigarrilhas e cigarros, outros', keywords: ['cigarro', 'cigarrilha', 'fumo'] },
  { code: '24031100', description: 'Tabaco para narguilé', keywords: ['fumo', 'narguile', 'cachimbo'] },
  { code: '24031900', description: 'Tabaco para fumar, outros', keywords: ['fumo', 'cachimbo'] },
  { code: '24039100', description: 'Tabaco homogeneizado ou reconstituído', keywords: ['fumo'] },
  { code: '24039910', description: 'Extratos e molhos de tabaco', keywords: ['fumo'] },
  { code: '24039990', description: 'Outros produtos de tabaco e seus sucedâneos manufaturados', keywords: ['fumo'] },
  { code: '25010020', description: 'Sal refinado' }
];

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const normalizeNcmDigits = (value: string) => value.replace(/\D/g, '').slice(0, 8);

export const formatNcmCode = (value: string) => {
  const digits = normalizeNcmDigits(value);
  if (digits.length <= 4) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  }

  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
};

const getSearchHaystack = (item: NcmLookupItem) =>
  normalizeSearchText([item.code, formatNcmCode(item.code), item.description, ...(item.keywords ?? [])].join(' '));

export const searchNcmCatalog = (query: string, limit = 12) => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedQueryDigits = normalizeNcmDigits(query);

  if (!normalizedQuery && !normalizedQueryDigits) {
    return ncmLookupCatalog.slice(0, Math.min(limit, 8));
  }

  return ncmLookupCatalog
    .map((item) => {
      const codeScore = normalizedQueryDigits && item.code.includes(normalizedQueryDigits) ? 0 : 10;
      const textScore = getSearchHaystack(item).includes(normalizedQuery) ? 0 : 10;
      return { item, score: Math.min(codeScore, textScore) };
    })
    .filter(({ score }) => score < 10)
    .sort((a, b) => a.score - b.score || a.item.code.localeCompare(b.item.code))
    .map(({ item }) => item)
    .slice(0, limit);
};
