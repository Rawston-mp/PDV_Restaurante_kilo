import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import {
  buildComandaCategories,
  defaultProductCategories,
  getCategoryVisual,
  isSameCategoryName,
  mergeCategoryOptions,
  normalizeCategoryName,
  persistProductCategories,
  readStoredProductCategories,
  sanitizeCategoryOptions
} from '@/modules/products/domain/services/productCategories';
import {
  calculateSaleUnitCost,
  inferUnitsPerPurchase,
  isPackageUnit,
  normalizeProductUnit,
  productUnitOptions,
  type ProductUnit
} from '@/modules/products/domain/services/productUnits';
import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';
import {
  clearNfeProductDraft,
  readNfeProductDraft,
  writeNfeProductDraftResult,
  type NfeProductDraftResult
} from '@/modules/products/infrastructure/local/nfeProductDraft';
import { useCreateProduct } from '@/modules/products/presentation/hooks/useCreateProduct';
import { useProductsQuery } from '@/modules/products/presentation/hooks/useProductsQuery';

const cfopOptions = ['5102 - VENDA', '5405 - VENDA COM ST', '5101 - VENDAS - BC REDUZIDA'];

const fiscalTypeOptions = [
  'Sem substituicao tributaria',
  'Produzida internamente',
  'Com substituicao tributaria'
];

const fiscalTypeLabels: Record<string, string> = {
  'Sem substituicao tributaria': 'Sem substituição tributária',
  'Produzida internamente': 'Produzida internamente',
  'Com substituicao tributaria': 'Com substituição tributária'
};

const cstIcmsOptions = [
  '0 - Nacional (exceto as indicadas nos codigos 3, 4, 5 e 8)',
  '1 - Estrangeira - Importacao direta',
  '2 - Estrangeira - Adquirida no mercado interno',
  '3 - Nacional, conteudo superior a 40% e inferior ou igual a 70%',
  '4 - Nacional, processos produtivos basicos',
  '5 - Nacional, conteudo inferior a 40%',
  '6 - Estrangeira - Importacao direta, com similar nacional, lista CAMEX',
  '7 - Estrangeira - mercado interno, sem similar, lista CAMEX',
  '8 - Nacional, Conteudo de importacao superior a 70%'
];

const cstIcmsLabels: Record<string, string> = {
  [cstIcmsOptions[0]]: '0 - Nacional (exceto as indicadas nos códigos 3, 4, 5 e 8)',
  [cstIcmsOptions[1]]: '1 - Estrangeira - Importação direta',
  [cstIcmsOptions[2]]: '2 - Estrangeira - Adquirida no mercado interno',
  [cstIcmsOptions[3]]: '3 - Nacional, conteúdo superior a 40% e inferior ou igual a 70%',
  [cstIcmsOptions[4]]: '4 - Nacional, processos produtivos básicos',
  [cstIcmsOptions[5]]: '5 - Nacional, conteúdo inferior a 40%',
  [cstIcmsOptions[6]]: '6 - Estrangeira - Importação direta, com similar nacional, lista CAMEX',
  [cstIcmsOptions[7]]: '7 - Estrangeira - Mercado interno, sem similar, lista CAMEX',
  [cstIcmsOptions[8]]: '8 - Nacional, conteúdo de importação superior a 70%'
};

const cstPisCofinsOptions = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '49',
  '50',
  '51',
  '52',
  '53'
];

const taxSituationCodeOptions = ['61', '102', '300', '400', '500', '900'];

const ncmLookupCatalog = [
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
  { code: '25010020', description: 'Sal refinado' }
];

const normalizeNcmDigits = (value: string) => value.replace(/\D/g, '').slice(0, 8);

const formatNcmCode = (value: string) => {
  const digits = normalizeNcmDigits(value);
  if (digits.length <= 4) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  }

  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
};

const parseLegacyProductCode = (productName: string) => {
  const [firstChunk] = productName.split(' - ');
  return /^\d{2,4}$/.test(firstChunk) ? firstChunk : null;
};

const getUsedProductCodes = (products: Array<{ productCode?: string; name: string }>) => {
  const usedCodes = new Set<string>();

  for (const product of products) {
    const code = product.productCode ?? parseLegacyProductCode(product.name);
    if (code) {
      usedCodes.add(code);
    }
  }

  return usedCodes;
};

const getProductDisplayName = (product: { productCode?: string; name: string }) => {
  const legacyCode = parseLegacyProductCode(product.name);
  if (legacyCode) {
    return product.name.split(' - ').slice(1).join(' - ');
  }

  return product.name;
};

const generateRandomProductCode = (usedCodes: Set<string>) => {
  for (let attempts = 0; attempts < 300; attempts += 1) {
    const candidate = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
    if (!usedCodes.has(candidate)) {
      return candidate;
    }
  }

  // Fallback para manter a unicidade mesmo com alta ocupação de códigos curtos.
  for (let fallback = 100; fallback <= 9999; fallback += 1) {
    const candidate = String(fallback);
    if (!usedCodes.has(candidate)) {
      return candidate;
    }
  }

  return String(Date.now()).slice(-4);
};

const calculateSalePrice = (costValue: number, marginPercent: number) => {
  const base = Number.isFinite(costValue) ? costValue : 0;
  const margin = Number.isFinite(marginPercent) ? marginPercent : 0;
  return Number((base * (1 + margin / 100)).toFixed(2));
};

const calculateMarginProfit = (costValue: number, salePrice: number) => {
  const base = Number.isFinite(costValue) ? costValue : 0;
  const sale = Number.isFinite(salePrice) ? salePrice : 0;

  if (base <= 0 || sale <= 0) {
    return 0;
  }

  return Number((((sale - base) / base) * 100).toFixed(2));
};

const parseDecimalInput = (value: string) => {
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_PRODUCT_IMAGE_DIMENSION = 1280;
const PRODUCT_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const imageFileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Arquivo de imagem inválido.'));
    };

    reader.onerror = () => {
      reject(new Error('Falha ao ler arquivo de imagem.'));
    };

    reader.readAsDataURL(file);
  });

const loadImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Falha ao processar imagem.'));
    image.src = source;
  });

const compressImageToDataUrl = async (file: File): Promise<string> => {
  const sourceDataUrl = await imageFileToDataUrl(file);
  const image = await loadImage(sourceDataUrl);

  const scale = Math.min(
    1,
    MAX_PRODUCT_IMAGE_DIMENSION / Math.max(image.width || 1, image.height || 1)
  );

  const outputWidth = Math.max(1, Math.round((image.width || 1) * scale));
  const outputHeight = Math.max(1, Math.round((image.height || 1) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Falha ao gerar miniatura da imagem.');
  }

  context.drawImage(image, 0, 0, outputWidth, outputHeight);

  const quality = file.type === 'image/png' ? undefined : 0.82;
  const compressedDataUrl = canvas.toDataURL(file.type, quality);

  if (compressedDataUrl.length > MAX_PRODUCT_IMAGE_OUTPUT_BYTES * 2) {
    throw new Error('Imagem final muito grande.');
  }

  return compressedDataUrl;
};

const isFilled = (value: string) => value.trim().length > 0;

type ProductsPageProps = {
  onNfeProductSaved?: (result: NfeProductDraftResult) => void;
};

export function ProductsPage({ onNfeProductSaved }: ProductsPageProps = {}) {
  const { products, setProducts, reload } = useProductsQuery();
  const { createProduct, saving } = useCreateProduct();
  const { can } = useAuth();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const nfeDraftAppliedRef = useRef(false);

  const [showCadastroSpan, setShowCadastroSpan] = useState(false);
  const [activeTab, setActiveTab] = useState<'PRODUTO' | 'FISCAL'>('PRODUTO');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productCode, setProductCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(readStoredProductCategories);
  const [category, setCategory] = useState(defaultProductCategories[0]);
  const [categoryManagerMode, setCategoryManagerMode] = useState<'ADD' | 'EDIT' | 'DELETE' | null>(null);
  const [categoryTargetName, setCategoryTargetName] = useState(defaultProductCategories[0]);
  const [categoryDraftName, setCategoryDraftName] = useState('');
  const [categoryActionError, setCategoryActionError] = useState<string | null>(null);
  const [ncm, setNcm] = useState('');
  const [showNcmLookup, setShowNcmLookup] = useState(false);
  const [ncmSearchQuery, setNcmSearchQuery] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [costValue, setCostValue] = useState(0);
  const [marginProfit, setMarginProfit] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [byWeight, setByWeight] = useState(false);
  const [purchaseUnit, setPurchaseUnit] = useState<ProductUnit>('UN');
  const [saleUnit, setSaleUnit] = useState<ProductUnit>('UN');
  const [unitsPerPurchase, setUnitsPerPurchase] = useState(1);
  const [purchaseCostValue, setPurchaseCostValue] = useState(0);

  const [cfop, setCfop] = useState(cfopOptions[0]);
  const [cstIcms, setCstIcms] = useState(cstIcmsOptions[0]);
  const [taxSituationCode, setTaxSituationCode] = useState(taxSituationCodeOptions[0]);
  const [aliqIcms, setAliqIcms] = useState('');
  const [cstPis, setCstPis] = useState(cstPisCofinsOptions[0]);
  const [aliqPis, setAliqPis] = useState('');
  const [cstCofins, setCstCofins] = useState(cstPisCofinsOptions[0]);
  const [aliqCofins, setAliqCofins] = useState('');
  const [fiscalType, setFiscalType] = useState(fiscalTypeOptions[0]);
  const [nfeDraftSourceItemId, setNfeDraftSourceItemId] = useState<string | null>(null);

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const canEditOrDelete = can('products:manage');
  const isNewCadastro = editingProductId === null;

  useEffect(() => {
    if (!canEditOrDelete || nfeDraftAppliedRef.current) {
      return;
    }

    const draft = readNfeProductDraft();
    if (!draft) {
      return;
    }

    const importedPurchaseCost = parseDecimalInput(draft.unitCost);
    const importedPurchaseUnit = normalizeProductUnit(draft.unit);
    const importedUnitsPerPurchase = inferUnitsPerPurchase(draft.name, importedPurchaseUnit);
    const importedSaleUnit = isPackageUnit(importedPurchaseUnit) ? 'UN' : importedPurchaseUnit;
    const importedSaleUnitCost = calculateSaleUnitCost(importedPurchaseCost, importedUnitsPerPurchase);
    const importedOrigin = cstIcmsOptions.find((option) => option.startsWith(`${draft.origin} -`)) ?? cstIcmsOptions[0];
    const importedFiscalType = ['10', '30', '60', '70', '201', '202', '203', '500'].includes(draft.cstOrCsosn)
      ? 'Com substituicao tributaria'
      : fiscalTypeOptions[0];

    nfeDraftAppliedRef.current = true;
    setNfeDraftSourceItemId(draft.sourceItemId);
    setEditingProductId(null);
    setShowCadastroSpan(true);
    setActiveTab('PRODUTO');
    setFormError(null);
    setProductCode(generateRandomProductCode(getUsedProductCodes(products)));
    setName(draft.name);
    setDescription([
      draft.xmlProductCode ? `Código do fornecedor: ${draft.xmlProductCode}` : '',
      draft.unit ? `Unidade: ${draft.unit}` : ''
    ].filter(Boolean).join(' | '));
    setBarcode(draft.barcode);
    setCategory(categoryOptions[0] ?? defaultProductCategories[0]);
    setNcm(formatNcmCode(draft.ncm));
    setNcmSearchQuery(draft.ncm);
    setPurchaseUnit(importedPurchaseUnit);
    setSaleUnit(importedSaleUnit);
    setUnitsPerPurchase(importedUnitsPerPurchase);
    setPurchaseCostValue(importedPurchaseCost);
    setCostValue(importedSaleUnitCost);
    setMarginProfit(0);
    setSalePrice(importedSaleUnitCost);
    setStock(0);
    setByWeight(importedSaleUnit === 'KG');
    setCfop(draft.cfop || cfopOptions[0]);
    setCstIcms(importedOrigin);
    setTaxSituationCode(draft.cstOrCsosn || taxSituationCodeOptions[0]);
    setAliqIcms(draft.aliqIcms || '0');
    setCstPis(draft.cstPis || cstPisCofinsOptions[0]);
    setAliqPis(draft.aliqPis || '0');
    setCstCofins(draft.cstCofins || cstPisCofinsOptions[0]);
    setAliqCofins(draft.aliqCofins || '0');
    setFiscalType(importedFiscalType);
    setSyncMessage('Produto preenchido automaticamente com os dados da NF-e. Confira Produto e Fiscal antes de salvar.');
  }, [canEditOrDelete, categoryOptions, products]);

  const getNumericInputValue = (value: number) => {
    if (isNewCadastro && value === 0) {
      return '';
    }

    return String(value);
  };

  useEffect(() => {
    const mergedCategories = mergeCategoryOptions(readStoredProductCategories(), products);
    setCategoryOptions((current) => {
      const currentNormalized = sanitizeCategoryOptions(current);
      const nextNormalized = sanitizeCategoryOptions(mergedCategories);

      if (JSON.stringify(currentNormalized) === JSON.stringify(nextNormalized)) {
        return current;
      }

      persistProductCategories(nextNormalized);
      return nextNormalized;
    });
  }, [products]);

  useEffect(() => {
    if (categoryOptions.length === 0) {
      return;
    }

    if (!categoryOptions.some((option) => isSameCategoryName(option, category))) {
      setCategory(categoryOptions[0]);
    }
  }, [category, categoryOptions]);

  useEffect(() => {
    if (!showCadastroSpan || activeTab !== 'PRODUTO' || !isNewCadastro) {
      return;
    }

    nameInputRef.current?.focus();
  }, [activeTab, isNewCadastro, showCadastroSpan]);

  const resetCadastroForm = () => {
    setEditingProductId(null);
    setFormError(null);
    setName('');
    setDescription('');
    setProductCode(generateCodeForCurrentCatalog());
    setBarcode('');
    setImageUrl('');
    setImageUploadError(null);
    setIsUnavailable(false);
    setIsHidden(false);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    setCategory(categoryOptions[0] ?? defaultProductCategories[0]);
    setNcm('');
    setNcmSearchQuery('');
    setShowNcmLookup(false);
    setCostValue(0);
    setMarginProfit(0);
    setSalePrice(0);
    setStock(0);
    setByWeight(false);
    setPurchaseUnit('UN');
    setSaleUnit('UN');
    setUnitsPerPurchase(1);
    setPurchaseCostValue(0);
    setCfop(cfopOptions[0]);
    setCstIcms(cstIcmsOptions[0]);
    setTaxSituationCode(taxSituationCodeOptions[0]);
    setAliqIcms('');
    setCstPis(cstPisCofinsOptions[0]);
    setAliqPis('');
    setCstCofins(cstPisCofinsOptions[0]);
    setAliqCofins('');
    setFiscalType(fiscalTypeOptions[0]);
    setActiveTab('PRODUTO');
  };

  const saveCategoryOptions = (nextCategories: string[]) => {
    const sanitized = sanitizeCategoryOptions(nextCategories);
    setCategoryOptions(sanitized);
    persistProductCategories(sanitized);
    return sanitized;
  };

  const syncProductsCategory = async (currentCategory: string, nextCategory: string) => {
    if (isSameCategoryName(currentCategory, nextCategory)) {
      return;
    }

    const now = new Date();
    const affectedProducts = products.filter((product) => isSameCategoryName(product.category, currentCategory));

    if (affectedProducts.length === 0) {
      return;
    }

    const updatedProducts = affectedProducts.map((product) => ({
      ...product,
      category: nextCategory,
      updatedAt: now,
      version: product.version + 1
    }));

    await Promise.all(updatedProducts.map((product) => productsContainer.productRepository.save(product)));

    setProducts((prev) =>
      prev.map((product) => updatedProducts.find((updated) => updated.id === product.id) ?? product)
    );
  };

  const closeCategoryManager = () => {
    setCategoryManagerMode(null);
    setCategoryTargetName(category);
    setCategoryDraftName('');
    setCategoryActionError(null);
  };

  const openCategoryManager = (mode: 'ADD' | 'EDIT' | 'DELETE') => {
    const targetCategory = categoryOptions.find((option) => isSameCategoryName(option, category)) ?? categoryOptions[0];
    setCategoryManagerMode(mode);
    setCategoryTargetName(targetCategory);
    setCategoryDraftName(mode === 'EDIT' ? targetCategory : '');
    setCategoryActionError(null);
  };

  const onSubmitCategoryManager = async (event: FormEvent) => {
    event.preventDefault();

    if (!categoryManagerMode) {
      return;
    }

    if (categoryManagerMode === 'ADD') {
      const nextCategoryName = normalizeCategoryName(categoryDraftName);

      if (!nextCategoryName) {
        setCategoryActionError('Informe o nome da nova categoria.');
        return;
      }

      if (categoryOptions.some((option) => isSameCategoryName(option, nextCategoryName))) {
        setCategoryActionError('Já existe uma categoria com esse nome.');
        return;
      }

      saveCategoryOptions([...categoryOptions, nextCategoryName]);
      setCategory(nextCategoryName);
      closeCategoryManager();
      return;
    }

    const targetCategory = categoryOptions.find((option) => isSameCategoryName(option, categoryTargetName));
    if (!targetCategory) {
      setCategoryActionError('Selecione uma categoria valida.');
      return;
    }

    if (categoryManagerMode === 'EDIT') {
      const nextCategoryName = normalizeCategoryName(categoryDraftName);

      if (!nextCategoryName) {
        setCategoryActionError('Informe o novo nome da categoria.');
        return;
      }

      if (
        categoryOptions.some(
          (option) => !isSameCategoryName(option, targetCategory) && isSameCategoryName(option, nextCategoryName)
        )
      ) {
        setCategoryActionError('Já existe outra categoria com esse nome.');
        return;
      }

      saveCategoryOptions(categoryOptions.map((option) => (isSameCategoryName(option, targetCategory) ? nextCategoryName : option)));
      await syncProductsCategory(targetCategory, nextCategoryName);

      if (isSameCategoryName(category, targetCategory)) {
        setCategory(nextCategoryName);
      }

      closeCategoryManager();
      return;
    }

    if (categoryOptions.length === 1) {
      setCategoryActionError('Não é possível excluir a única categoria cadastrada.');
      return;
    }

    const fallbackCategory = categoryOptions.find((option) => !isSameCategoryName(option, targetCategory));
    if (!fallbackCategory) {
      setCategoryActionError('Não foi possível definir a categoria de destino.');
      return;
    }

    await syncProductsCategory(targetCategory, fallbackCategory);
    saveCategoryOptions(categoryOptions.filter((option) => !isSameCategoryName(option, targetCategory)));

    if (isSameCategoryName(category, targetCategory)) {
      setCategory(fallbackCategory);
    }

    closeCategoryManager();
  };

  const deleteFallbackCategory =
    categoryManagerMode === 'DELETE'
      ? categoryOptions.find((option) => !isSameCategoryName(option, categoryTargetName)) ?? null
      : null;

  const ncmLookupResults = useMemo(() => {
    const query = ncmSearchQuery.trim().toLowerCase();
    if (!query) {
      return ncmLookupCatalog.slice(0, 8);
    }

    const normalizedQueryDigits = normalizeNcmDigits(query);

    return ncmLookupCatalog
      .filter((item) => {
        if (normalizedQueryDigits && item.code.includes(normalizedQueryDigits)) {
          return true;
        }

        return item.description.toLowerCase().includes(query);
      })
      .slice(0, 12);
  }, [ncmSearchQuery]);

  const generateCodeForCurrentCatalog = () => {
    const usedCodes = getUsedProductCodes(products);
    return generateRandomProductCode(usedCodes);
  };

  const onSyncProducts = async () => {
    try {
      const result = await productsContainer.syncProducts.execute();
      await reload();
      setSyncMessage(
        `Sincronização de produtos: ${result.mergedCount} itens, ${result.resolvedConflicts} conflitos.`
      );
    } catch (error) {
      await productsContainer.syncTaskQueue.enqueue('SYNC_PRODUCTS');
      setSyncMessage(
        `Falha na sincronização. Tarefa enviada para a fila: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`
      );
    }
  };

  const onProcessSyncQueue = async () => {
    const result = await productsContainer.processSyncQueue.execute();
    await reload();
    const pending = await productsContainer.syncTaskQueue.listAll();

    setSyncMessage(
      `Fila processada: ${result.processed} tarefas, ${result.succeeded} sucesso, ${result.failed} falha. Pendentes: ${pending.length}.`
    );
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canEditOrDelete) {
      setFormError('O perfil de comanda não pode cadastrar nem editar produtos.');
      return;
    }

    if (!isFilled(ncm)) {
      setFormError('Preencha o NCM antes de salvar o produto.');
      setActiveTab('PRODUTO');
      return;
    }

    if (!isFilled(aliqIcms) || !isFilled(aliqPis) || !isFilled(aliqCofins)) {
      setFormError('Preencha as alíquotas fiscais (ICMS, PIS e COFINS) antes de salvar.');
      setActiveTab('FISCAL');
      return;
    }

    const usedCodes = getUsedProductCodes(products.filter((product) => product.id !== editingProductId));
    const generatedCode = productCode && !usedCodes.has(productCode)
      ? productCode
      : generateRandomProductCode(usedCodes);
    let savedProductId = editingProductId;

    if (editingProductId) {
      const existingProduct = products.find((product) => product.id === editingProductId);

      if (!existingProduct) {
        setFormError('O produto selecionado para edição não foi encontrado.');
        return;
      }

      const updatedProduct = {
        ...existingProduct,
        productCode: generatedCode,
        barcode,
        imageUrl: imageUrl.trim() || undefined,
        name,
        description: description.trim() || undefined,
        isUnavailable,
        isHidden,
        category,
        ncm,
        cfop,
        cstIcms,
        taxSituationCode,
        aliqIcms,
        cstPis,
        aliqPis,
        cstCofins,
        aliqCofins,
        fiscalType,
        purchaseUnit,
        saleUnit,
        unitsPerPurchase,
        purchaseCostValue,
        costValue,
        marginProfit,
        price: salePrice,
        stock,
        byWeight,
        updatedAt: new Date(),
        version: existingProduct.version + 1
      };

      await productsContainer.productRepository.save(updatedProduct);
      setProducts((prev) => prev.map((product) => (product.id === editingProductId ? updatedProduct : product)));
    } else {
      const product = await createProduct({
        productCode: generatedCode,
        barcode,
        imageUrl: imageUrl.trim() || undefined,
        name,
        description: description.trim() || undefined,
        isUnavailable,
        isHidden,
        category,
        ncm,
        cfop,
        cstIcms,
        taxSituationCode,
        aliqIcms,
        cstPis,
        aliqPis,
        cstCofins,
        aliqCofins,
        fiscalType,
        purchaseUnit,
        saleUnit,
        unitsPerPurchase,
        purchaseCostValue,
        costValue,
        marginProfit,
        price: salePrice,
        stock,
        byWeight
      });

      setProducts((prev) => [...prev, product]);
      savedProductId = product.id;
    }

    if (nfeDraftSourceItemId && savedProductId) {
      const result = {
        sourceItemId: nfeDraftSourceItemId,
        productId: savedProductId,
        productName: name
      };
      writeNfeProductDraftResult(result);
      clearNfeProductDraft();
      setNfeDraftSourceItemId(null);
      setSyncMessage('Produto cadastrado e vinculado à entrada de estoque.');
      onNfeProductSaved?.(result);
    }

    resetCadastroForm();
    setProductCode(generateRandomProductCode(new Set([...usedCodes, generatedCode])));
    setShowCadastroSpan(false);
  };

  const onEditProduct = (productId: string) => {
    if (!canEditOrDelete) {
      setFormError('O perfil de comanda não pode editar produtos.');
      return;
    }

    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    setEditingProductId(product.id);
    setShowCadastroSpan(true);
    setActiveTab('PRODUTO');
    setFormError(null);
    setImageUploadError(null);

    setProductCode(product.productCode ?? parseLegacyProductCode(product.name) ?? generateCodeForCurrentCatalog());
    setName(getProductDisplayName(product));
    setDescription(product.description ?? '');
    setBarcode(product.barcode ?? '');
    setImageUrl(product.imageUrl ?? '');
    setIsUnavailable(Boolean(product.isUnavailable));
    setIsHidden(Boolean(product.isHidden));
    setCategory(product.category);
    setNcm(product.ncm ?? '');
    setNcmSearchQuery(product.ncm ?? '');
    setShowNcmLookup(false);
    setStock(product.stock);
    setByWeight(product.byWeight);
    setPurchaseUnit(normalizeProductUnit(product.purchaseUnit));
    setSaleUnit(normalizeProductUnit(product.saleUnit));
    setUnitsPerPurchase(product.unitsPerPurchase && product.unitsPerPurchase > 0 ? product.unitsPerPurchase : 1);
    setPurchaseCostValue(product.purchaseCostValue ?? product.costValue ?? 0);
    setCostValue(product.costValue ?? 0);
    setMarginProfit(product.marginProfit ?? 0);
    setSalePrice(product.price);

    setCfop(product.cfop ?? cfopOptions[0]);
    setCstIcms(product.cstIcms ?? cstIcmsOptions[0]);
    setTaxSituationCode(product.taxSituationCode ?? taxSituationCodeOptions[0]);
    setAliqIcms(product.aliqIcms ?? '');
    setCstPis(product.cstPis ?? cstPisCofinsOptions[0]);
    setAliqPis(product.aliqPis ?? '');
    setCstCofins(product.cstCofins ?? cstPisCofinsOptions[0]);
    setAliqCofins(product.aliqCofins ?? '');
    setFiscalType(product.fiscalType ?? fiscalTypeOptions[0]);
  };

  const onDeleteProduct = async (productId: string) => {
    if (!canEditOrDelete) {
      setFormError('O perfil de comanda não pode excluir produtos.');
      return;
    }

    const target = products.find((product) => product.id === productId);
    if (!target) {
      return;
    }

    const confirmed = window.confirm(`Deseja excluir o produto "${getProductDisplayName(target)}"?`);
    if (!confirmed) {
      return;
    }

    await productsContainer.productRepository.delete(productId);
    setProducts((prev) => prev.filter((product) => product.id !== productId));

    if (editingProductId === productId) {
      setShowCadastroSpan(false);
      setEditingProductId(null);
      setFormError(null);
    }
  };

  const onUploadProductImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!PRODUCT_IMAGE_MIME_TYPES.has(file.type)) {
      setImageUploadError('Formato inválido. Use JPG, PNG ou WEBP.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      setImageUploadError('Imagem muito grande. Limite de 8MB no arquivo original.');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await compressImageToDataUrl(file);
      setImageUrl(dataUrl);
      setImageUploadError(null);
      setFormError(null);
    } catch {
      setImageUploadError('Não foi possível carregar ou comprimir a imagem selecionada.');
    } finally {
      event.target.value = '';
    }
  };

  const openCadastroForCategory = (nextCategory: string) => {
    if (!canEditOrDelete) {
      return;
    }

    if (!showCadastroSpan) {
      resetCadastroForm();
      setShowCadastroSpan(true);
    }

    setActiveTab('PRODUTO');
    setCategory(nextCategory);
  };

  return (
    <section className="products-page">
      <header className="products-header card">
        <div>
          <p className="products-eyebrow">Catalogo e precificacao</p>
          <h2>Produtos</h2>
          <p className="products-subtitle">Cadastre e sincronize itens com foco em operação rápida de caixa.</p>
        </div>
        <div className="products-kpi">
          <strong>{products.length}</strong>
          <span>itens cadastrados</span>
        </div>
      </header>

      <article className="card products-toolbar">
        <div className="products-toolbar-actions">
          {canEditOrDelete && (
            <button
              type="button"
              className="products-new-button"
              onClick={() => {
                if (!showCadastroSpan) {
                  resetCadastroForm();
                }

                setShowCadastroSpan((prev) => !prev);
              }}
            >
              + Novo cadastro
            </button>
          )}
          <button type="button" onClick={onSyncProducts}>
            Sincronizar produtos
          </button>
          <button type="button" className="button-muted" onClick={onProcessSyncQueue}>
            Processar fila de sincronização
          </button>
        </div>
        {syncMessage && <p className="sync-banner">{syncMessage}</p>}
      </article>

      {canEditOrDelete && (
        <article className="card products-cadastro-quickbar">
          <p className="products-help-note">Categorias rápidas: clique para abrir o cadastro já na categoria.</p>
          <div className="products-category-quickbar" role="tablist" aria-label="Categorias rapidas de cadastro">
            {categoryOptions.map((option) => {
              const isActiveCategory = isSameCategoryName(option, category);
              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={isActiveCategory}
                  className={`products-category-chip ${isActiveCategory ? 'is-active' : ''}`}
                  onClick={() => openCadastroForCategory(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </article>
      )}

      {canEditOrDelete && showCadastroSpan && (
        <article className="card products-cadastro-span">
          <header className="products-cadastro-header">
            <h3>Produtos &gt; Cadastro</h3>
            <div className="products-cadastro-tabs">
              <button
                type="button"
                className={activeTab === 'PRODUTO' ? 'is-active' : ''}
                onClick={() => setActiveTab('PRODUTO')}
              >
                Produto
              </button>
              <button
                type="button"
                className={activeTab === 'FISCAL' ? 'is-active' : ''}
                onClick={() => setActiveTab('FISCAL')}
              >
                Fiscal
              </button>
            </div>
          </header>

          <form onSubmit={onSubmit} className="products-form" autoComplete="off">
            {activeTab === 'PRODUTO' ? (
              <>
                <div className="products-row-4">
                  <div className="products-field-compact">
                    <label htmlFor="product-code">ID do produto (automático)</label>
                    <input
                      id="product-code"
                      placeholder="Gerado automaticamente"
                      value={productCode}
                      autoComplete="off"
                      readOnly
                    />
                    <small className="products-help-note">Gerado aleatoriamente e sem repeticao no catalogo.</small>
                  </div>
                  <div className="products-field-main">
                    <label htmlFor="name">Nome</label>
                    <input
                      id="name"
                      ref={nameInputRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      required
                    />
                  </div>
                  <div className="products-field-main">
                    <label htmlFor="description">Descrição</label>
                    <input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Descrição exibida no caixa"
                    />
                  </div>
                  <div>
                    <label htmlFor="barcode">Código de barras</label>
                    <input id="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} autoComplete="off" />
                  </div>
                  <div className="products-photo-field">
                    <label htmlFor="image-upload">Foto do produto</label>
                    <input
                      id="image-upload"
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        void onUploadProductImage(event);
                      }}
                    />
                    <small className="products-help-note">PNG, JPG ou WEBP de até 2 MB.</small>

                    {imageUploadError && <small className="products-form-warning">{imageUploadError}</small>}

                    {imageUrl && (
                      <div className="products-image-preview">
                        <img
                          src={imageUrl}
                          alt="Preview do produto"
                          className="products-image-preview-img"
                        />
                        <button
                          type="button"
                          className="button-muted"
                          onClick={() => {
                            setImageUrl('');
                            setImageUploadError(null);
                          }}
                        >
                          Remover foto
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="products-group-field">
                    <label htmlFor="category">Categorias</label>
                    <div className="products-group-row">
                      <div className="products-category-quickbar" role="tablist" aria-label="Barra de categorias">
                        {categoryOptions.map((option) => {
                          const isActiveCategory = isSameCategoryName(option, category);
                          return (
                            <button
                              key={option}
                              type="button"
                              role="tab"
                              aria-selected={isActiveCategory}
                              className={`products-category-chip ${isActiveCategory ? 'is-active' : ''}`}
                              onClick={() => setCategory(option)}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>

                      <div className="products-group-input-row">
                        <select
                          id="category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          {categoryOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="products-group-action-button"
                          onClick={() => openCategoryManager('ADD')}
                          aria-label="Cadastrar categoria"
                          title="Cadastrar categoria"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="products-group-action-button is-edit"
                          onClick={() => openCategoryManager('EDIT')}
                          aria-label="Editar categoria"
                          title="Editar categoria"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="products-group-action-button is-delete"
                          onClick={() => openCategoryManager('DELETE')}
                          aria-label="Excluir categoria"
                          title="Excluir categoria"
                          disabled={categoryOptions.length <= 1}
                        >
                          ×
                        </button>
                      </div>
                      <small className="products-help-note products-group-help-note">
                        Cadastre, edite ou exclua categorias daqui. As telas de comanda usam a mesma lista.
                      </small>
                    </div>
                  </div>
                </div>

                <div className="products-row-2">
                  <div className="products-field-compact">
                    <label htmlFor="ncm">NCM</label>
                    <div className="ncm-input-row">
                      <input
                        id="ncm"
                        value={ncm}
                        onChange={(e) => setNcm(formatNcmCode(e.target.value))}
                        placeholder="0000.00.00"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="ncm-search-trigger"
                        aria-label="Buscar NCM"
                        title="Buscar NCM"
                        onClick={() => {
                          setShowNcmLookup((prev) => !prev);
                          setNcmSearchQuery((prev) => prev || ncm);
                        }}
                      >
                        🔍
                      </button>
                    </div>

                    {showNcmLookup && (
                      <div className="ncm-lookup-panel">
                        <input
                          value={ncmSearchQuery}
                          onChange={(e) => setNcmSearchQuery(e.target.value)}
                          placeholder="Buscar por código ou descrição"
                          aria-label="Buscar por código ou descrição de NCM"
                          autoComplete="off"
                        />
                        <ul>
                          {ncmLookupResults.length === 0 ? (
                            <li className="ncm-lookup-empty">Nenhum NCM encontrado.</li>
                          ) : (
                            ncmLookupResults.map((item) => (
                              <li key={item.code}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNcm(formatNcmCode(item.code));
                                    setNcmSearchQuery(item.code);
                                    setShowNcmLookup(false);
                                  }}
                                >
                                  <strong>{formatNcmCode(item.code)}</strong>
                                  <span>{item.description}</span>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="products-field-compact">
                    <label htmlFor="stock">Estoque inicial</label>
                    <input
                      id="stock"
                      type="number"
                      min={0}
                      step="1"
                      value={getNumericInputValue(stock)}
                      onChange={(e) => setStock(e.target.value === '' ? 0 : Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="products-cost-block">
                  <h4>Unidades e conversão</h4>
                  <div className="products-row-4">
                    <div className="products-field-compact">
                      <label htmlFor="purchase-unit">Unidade de compra</label>
                      <select
                        id="purchase-unit"
                        value={purchaseUnit}
                        onChange={(event) => {
                          const nextUnit = event.target.value as ProductUnit;
                          const nextConversion = isPackageUnit(nextUnit) ? unitsPerPurchase : 1;
                          const nextSaleUnit = isPackageUnit(nextUnit) ? saleUnit : nextUnit;
                          const nextUnitCost = calculateSaleUnitCost(purchaseCostValue, nextConversion);
                          setPurchaseUnit(nextUnit);
                          setSaleUnit(nextSaleUnit);
                          setUnitsPerPurchase(nextConversion);
                          setCostValue(nextUnitCost);
                          setSalePrice(calculateSalePrice(nextUnitCost, marginProfit));
                          setByWeight(nextSaleUnit === 'KG');
                        }}
                      >
                        {productUnitOptions.map((unitOption) => <option key={unitOption} value={unitOption}>{unitOption}</option>)}
                      </select>
                      <small className="products-help-note">Lida automaticamente da NF-e.</small>
                    </div>
                    <div className="products-field-compact">
                      <label htmlFor="units-per-purchase">Conteúdo da embalagem</label>
                      <input
                        id="units-per-purchase"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={unitsPerPurchase}
                        onChange={(event) => {
                          const nextConversion = Math.max(0.001, parseDecimalInput(event.target.value) || 1);
                          const nextUnitCost = calculateSaleUnitCost(purchaseCostValue, nextConversion);
                          setUnitsPerPurchase(nextConversion);
                          setCostValue(nextUnitCost);
                          setSalePrice(calculateSalePrice(nextUnitCost, marginProfit));
                        }}
                      />
                      <small className="products-help-note">Quantas unidades de venda existem na compra.</small>
                    </div>
                    <div className="products-field-compact">
                      <label htmlFor="sale-unit">Unidade de venda</label>
                      <select
                        id="sale-unit"
                        value={saleUnit}
                        onChange={(event) => {
                          const nextUnit = event.target.value as ProductUnit;
                          setSaleUnit(nextUnit);
                          setByWeight(nextUnit === 'KG');
                        }}
                      >
                        {productUnitOptions.map((unitOption) => <option key={unitOption} value={unitOption}>{unitOption}</option>)}
                      </select>
                    </div>
                    <div className="products-conversion-summary">
                      <span>Conversão aplicada</span>
                      <strong>1 {purchaseUnit} = {unitsPerPurchase} {saleUnit}</strong>
                    </div>
                  </div>
                </div>

                <div className="products-cost-block">
                  <h4>Custo e margem por unidade de venda</h4>
                  <div className="products-row-4">
                    <div className="products-field-compact">
                      <label htmlFor="purchase-cost-value">Custo por {purchaseUnit}</label>
                      <input
                        id="purchase-cost-value"
                        type="number"
                        min={0}
                        step="0.000001"
                        value={getNumericInputValue(purchaseCostValue)}
                        onChange={(e) => {
                          const nextPurchaseCost = e.target.value === '' ? 0 : parseDecimalInput(e.target.value);
                          const nextUnitCost = calculateSaleUnitCost(nextPurchaseCost, unitsPerPurchase);
                          setPurchaseCostValue(nextPurchaseCost);
                          setCostValue(nextUnitCost);
                          setSalePrice(calculateSalePrice(nextUnitCost, marginProfit));
                        }}
                      />
                    </div>
                    <div className="products-field-compact">
                      <label htmlFor="cost-value">Custo por {saleUnit}</label>
                      <input id="cost-value" type="number" value={costValue} readOnly />
                    </div>
                    <div className="products-field-compact">
                      <label htmlFor="margin-profit">Margem lucro %</label>
                      <input
                        id="margin-profit"
                        type="number"
                        min={0}
                        step="0.01"
                        value={getNumericInputValue(marginProfit)}
                        onChange={(e) => {
                          const nextMargin = e.target.value === '' ? 0 : parseDecimalInput(e.target.value);
                          setMarginProfit(nextMargin);
                          setSalePrice(calculateSalePrice(costValue, nextMargin));
                        }}
                      />
                    </div>
                    <div className="products-field-compact">
                      <label htmlFor="sale-price">Preço de venda</label>
                      <input
                        id="sale-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={getNumericInputValue(salePrice)}
                        onChange={(e) => {
                          const nextSale = e.target.value === '' ? 0 : parseDecimalInput(e.target.value);
                          setSalePrice(nextSale);
                          setMarginProfit(calculateMarginProfit(costValue, nextSale));
                        }}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="products-row-2">
                  <div>
                    <small className="products-help-note">
                      O custo de venda é calculado dividindo o custo da compra pelo conteúdo da embalagem. A margem e o preço usam esse custo convertido.
                    </small>
                  </div>
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={byWeight}
                    onChange={(e) => setByWeight(e.target.checked)}
                  />
                  Produto por peso
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isUnavailable}
                    onChange={(e) => setIsUnavailable(e.target.checked)}
                  />
                  Tornar indisponível no caixa
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isHidden}
                    onChange={(e) => setIsHidden(e.target.checked)}
                  />
                  Ocultar do caixa e dos terminais de balança
                </label>
              </>
            ) : (
              <>
                <div className="products-row-4 products-fiscal-row-top">
                  <div>
                    <label htmlFor="cfop">CFOP</label>
                    <select id="cfop" value={cfop} onChange={(e) => setCfop(e.target.value)}>
                      {cfop && !cfopOptions.includes(cfop) && <option value={cfop}>{cfop} - Importado da NF-e</option>}
                      {cfopOptions.map((option) => (
                        <option key={option} value={option}>
                          {cstIcmsLabels[option] ?? option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cst-icms">CST ICMS</label>
                    <select id="cst-icms" value={cstIcms} onChange={(e) => setCstIcms(e.target.value)}>
                      {cstIcmsOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <small className="products-help-note">Dica: use o código CST/CSOSN conforme seu regime.</small>
                  </div>
                  <div>
                    <label htmlFor="tax-situation-code">Código 61 a 900</label>
                    <select
                      id="tax-situation-code"
                      value={taxSituationCode}
                      onChange={(e) => setTaxSituationCode(e.target.value)}
                    >
                      {taxSituationCode && !taxSituationCodeOptions.includes(taxSituationCode) && (
                        <option value={taxSituationCode}>{taxSituationCode} - Importado da NF-e</option>
                      )}
                      {taxSituationCodeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="aliq-icms">Alíq. ICMS</label>
                    <input
                      id="aliq-icms"
                      placeholder="Ex.: 18,00"
                      value={aliqIcms}
                      onChange={(e) => setAliqIcms(e.target.value)}
                    />
                  </div>
                </div>

                <div className="products-row-3 products-fiscal-row-bottom">
                  <div>
                    <label htmlFor="cst-pis">CST PIS</label>
                    <select id="cst-pis" value={cstPis} onChange={(e) => setCstPis(e.target.value)}>
                      {cstPis && !cstPisCofinsOptions.includes(cstPis) && <option value={cstPis}>{cstPis} - Importado da NF-e</option>}
                      {cstPisCofinsOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="aliq-pis">Alíq. PIS</label>
                    <input
                      id="aliq-pis"
                      placeholder="Ex.: 1,65"
                      value={aliqPis}
                      onChange={(e) => setAliqPis(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="cst-cofins">CST COFINS</label>
                    <select id="cst-cofins" value={cstCofins} onChange={(e) => setCstCofins(e.target.value)}>
                      {cstCofins && !cstPisCofinsOptions.includes(cstCofins) && <option value={cstCofins}>{cstCofins} - Importado da NF-e</option>}
                      {cstPisCofinsOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="products-row-2 products-fiscal-row-end">
                  <div>
                    <label htmlFor="aliq-cofins">Alíq. COFINS</label>
                    <input
                      id="aliq-cofins"
                      placeholder="Ex.: 7,60"
                      value={aliqCofins}
                      onChange={(e) => setAliqCofins(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="fiscal-type">Tipo produto fiscal</label>
                    <select id="fiscal-type" value={fiscalType} onChange={(e) => setFiscalType(e.target.value)}>
                      {fiscalTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {fiscalTypeLabels[option] ?? option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="products-cadastro-footer">
              <button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editingProductId ? 'Salvar edição' : 'Salvar dados'}
              </button>
              <button
                type="button"
                className="button-muted"
                onClick={() => {
                  setShowCadastroSpan(false);
                  setEditingProductId(null);
                  setFormError(null);
                }}
              >
                Fechar cadastro
              </button>
            </div>

            {formError && <p className="products-form-warning">{formError}</p>}
          </form>
        </article>
      )}

      <div className="products-grid products-grid-list-only">
        <article className="card products-list-card">
          <h3>Catalogo ativo</h3>
          {products.length === 0 ? (
            <p className="empty-state">Nenhum produto cadastrado ainda.</p>
          ) : (
            <ul className="products-list">
              {products.map((product) => (
                <li key={product.id}>
                  <div>
                    <strong>
                      <span className="products-id-tag">ID {product.productCode ?? parseLegacyProductCode(product.name) ?? '--'}</span>{' '}
                      {getProductDisplayName(product)}
                    </strong>
                    {product.description ? <span>{product.description}</span> : <span />}
                    <span className={['products-group-tag', getCategoryVisual(product.category).className ?? ''].join(' ')}>
                      <b>{getCategoryVisual(product.category).icon}</b> {getCategoryVisual(product.category).label}
                    </span>
                  </div>
                  <div>
                    <strong>{currency.format(product.price)}</strong>
                    <span>estoque {product.stock} {product.saleUnit ?? 'UN'}</span>
                    <span>
                      compra {product.purchaseUnit ?? 'UN'} | 1 {product.purchaseUnit ?? 'UN'} = {product.unitsPerPurchase ?? 1} {product.saleUnit ?? 'UN'}
                    </span>
                    <span>
                      {product.isUnavailable ? 'indisponível' : 'disponível'} | {product.isHidden ? 'oculto' : 'visível'}
                    </span>
                    {canEditOrDelete && (
                      <span>
                        custo {product.costValue !== undefined ? currency.format(product.costValue) : '-'} | margem{' '}
                        {product.marginProfit !== undefined ? `${product.marginProfit.toFixed(2)}%` : '-'}
                      </span>
                    )}
                    {canEditOrDelete && (
                      <span>
                        cod. barras {product.barcode ?? '-'} | NCM {product.ncm ?? '-'} | CFOP {product.cfop ?? '-'}
                      </span>
                    )}
                    {canEditOrDelete && (
                      <div className="products-row-actions">
                        <button
                          type="button"
                          className="products-edit-button"
                          onClick={() => onEditProduct(product.id)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="products-delete-button"
                          onClick={() => void onDeleteProduct(product.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      {categoryManagerMode && (
        <div className="sensitive-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="products-group-manager-title">
          <section className="sensitive-modal">
            <h3 id="products-group-manager-title">
              {categoryManagerMode === 'ADD'
                ? 'Cadastrar categoria'
                : categoryManagerMode === 'EDIT'
                  ? 'Editar categoria'
                  : 'Excluir categoria'}
            </h3>
            <p>
              {categoryManagerMode === 'ADD'
                ? 'Cadastre uma nova categoria para usar no cadastro e na tela de comanda.'
                : categoryManagerMode === 'EDIT'
                  ? 'Renomeie uma categoria existente e atualize os produtos vinculados.'
                  : 'Exclua uma categoria e mova os produtos vinculados para outra categoria automaticamente.'}
            </p>

            <form onSubmit={onSubmitCategoryManager} autoComplete="off">
              {categoryManagerMode !== 'ADD' && (
                <>
                  <label htmlFor="products-group-target">Categoria</label>
                  <select
                    id="products-group-target"
                    value={categoryTargetName}
                    onChange={(event) => {
                      setCategoryTargetName(event.target.value);
                      if (categoryManagerMode === 'EDIT') {
                        setCategoryDraftName(event.target.value);
                      }
                    }}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {categoryManagerMode !== 'DELETE' && (
                <>
                  <label htmlFor="products-group-name">
                    {categoryManagerMode === 'ADD' ? 'Nome da nova categoria' : 'Novo nome da categoria'}
                  </label>
                  <input
                    id="products-group-name"
                    value={categoryDraftName}
                    onChange={(event) => setCategoryDraftName(event.target.value)}
                    placeholder={categoryManagerMode === 'ADD' ? 'Ex.: Massas' : 'Digite o novo nome'}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                  />
                </>
              )}

              {categoryManagerMode === 'DELETE' && deleteFallbackCategory && (
                <p className="products-group-modal-note">
                  Os produtos dessa categoria serao movidos para <strong>{deleteFallbackCategory}</strong>.
                </p>
              )}

              <div className="sensitive-modal-actions">
                <button type="submit" className={categoryManagerMode === 'DELETE' ? 'sensitive-cancel' : ''}>
                  {categoryManagerMode === 'ADD'
                    ? 'Cadastrar'
                    : categoryManagerMode === 'EDIT'
                      ? 'Salvar alteração'
                      : 'Confirmar exclusão'}
                </button>
                <button type="button" className="button-muted" onClick={closeCategoryManager}>
                  Cancelar
                </button>
              </div>

              {categoryActionError && <p className="products-form-warning">{categoryActionError}</p>}
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
