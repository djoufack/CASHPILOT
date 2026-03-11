const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const compactText = (value) => normalizeText(value).replace(/\s+/g, '');

const getUniqueMatch = (items) => (items.length === 1 ? items[0] : null);

export const linkLineItemsToProducts = (lineItems = [], products = []) => {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return [];
  if (!Array.isArray(products) || products.length === 0) {
    return lineItems.map((item) => ({ ...item, user_product_id: item?.user_product_id || null }));
  }

  const productsWithKeys = products.map((product) => ({
    ...product,
    __nameNorm: normalizeText(product.product_name),
    __nameCompact: compactText(product.product_name),
    __skuNorm: normalizeText(product.sku),
  }));

  const byName = new Map();
  const byNameCompact = new Map();
  const bySku = new Map();

  for (const product of productsWithKeys) {
    if (product.__nameNorm) {
      const list = byName.get(product.__nameNorm) || [];
      list.push(product);
      byName.set(product.__nameNorm, list);
    }

    if (product.__nameCompact) {
      const list = byNameCompact.get(product.__nameCompact) || [];
      list.push(product);
      byNameCompact.set(product.__nameCompact, list);
    }

    if (product.__skuNorm) {
      const list = bySku.get(product.__skuNorm) || [];
      list.push(product);
      bySku.set(product.__skuNorm, list);
    }
  }

  return lineItems.map((item) => {
    if (item?.user_product_id) {
      return item;
    }

    const descriptionNorm = normalizeText(item?.description);
    const descriptionCompact = compactText(item?.description);
    const itemSkuNorm = normalizeText(item?.sku);
    let matchedProduct = null;

    if (itemSkuNorm) {
      matchedProduct = getUniqueMatch(bySku.get(itemSkuNorm) || []);
    }

    if (!matchedProduct && descriptionNorm) {
      matchedProduct = getUniqueMatch(byName.get(descriptionNorm) || []);
    }

    if (!matchedProduct && descriptionCompact) {
      matchedProduct = getUniqueMatch(byNameCompact.get(descriptionCompact) || []);
    }

    if (!matchedProduct && descriptionNorm) {
      const skuCandidates = productsWithKeys.filter((product) => {
        if (!product.__skuNorm || product.__skuNorm.length < 3) return false;
        return descriptionNorm.includes(product.__skuNorm);
      });
      matchedProduct = getUniqueMatch(skuCandidates);
    }

    if (!matchedProduct && descriptionNorm.length >= 5) {
      const nameCandidates = productsWithKeys.filter((product) => {
        if (!product.__nameNorm || product.__nameNorm.length < 5) return false;
        return descriptionNorm.includes(product.__nameNorm) || product.__nameNorm.includes(descriptionNorm);
      });
      matchedProduct = getUniqueMatch(nameCandidates);
    }

    return {
      ...item,
      user_product_id: matchedProduct?.id || null,
    };
  });
};

