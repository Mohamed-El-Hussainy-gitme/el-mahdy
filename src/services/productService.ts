import { Product, ProductModelMatrixItem } from '@/types';

export interface ProductFilters {
  categoryId?: string;
  searchQuery?: string;
  priceRange?: [number, number];
  exchangeOnly?: boolean;
  brand?: string;
}

/**
 * Pure function filtering products based on selected criteria.
 */
export function filterProducts(products: Product[], filters: ProductFilters): Product[] {
  return products.filter((product) => {
    // Category filter
    if (
      filters.categoryId &&
      filters.categoryId !== 'all-products' &&
      !product.category_ids.includes(filters.categoryId)
    ) {
      return false;
    }

    // Search query
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchTitle = product.title_ar.toLowerCase().includes(q);
      const matchSku = product.sku.toLowerCase().includes(q);
      const matchDesc = product.description_ar?.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchSku && !matchDesc) {
        return false;
      }
    }

    // Exchange only filter
    if (filters.exchangeOnly && !product.is_exchange_only) {
      return false;
    }

    // Price range
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      if (product.price < min || product.price > max) {
        return false;
      }
    }

    // Brand filter (if product has matrix items matching brand)
    if (filters.brand && filters.brand.trim() !== '') {
      const brandLower = filters.brand.toLowerCase();
      if (!product.matrix_items || product.matrix_items.length === 0) {
        return false;
      }
      const hasBrand = product.matrix_items.some(
        (m) => m.model?.brand.toLowerCase() === brandLower
      );
      if (!hasBrand) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Validates product SKU and required fields prior to save.
 */
export function validateProductData(data: Partial<Product>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.sku || data.sku.trim().length === 0) {
    errors.push('كود المنتج (SKU) مطلوب.');
  }

  if (!data.title_ar || data.title_ar.trim().length === 0) {
    errors.push('عنوان المنتج بالعربية مطلوب.');
  }

  if (data.price === undefined || data.price === null || data.price < 0) {
    errors.push('السعر يجب أن يكون رقماً موجباً أو صفراً.');
  }

  if (!data.image_url || data.image_url.trim().length === 0) {
    errors.push('يجب رفع صورة المنتج الرئيسية أولاً.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Computes availability counters from product matrix items.
 */
export function calculateMatrixStockSummary(matrixItems?: ProductModelMatrixItem[]): {
  totalStock: number;
  inStockCount: number;
  limitedCount: number;
  outOfStockCount: number;
} {
  if (!matrixItems || matrixItems.length === 0) {
    return {
      totalStock: 0,
      inStockCount: 0,
      limitedCount: 0,
      outOfStockCount: 0,
    };
  }

  let totalStock = 0;
  let inStockCount = 0;
  let limitedCount = 0;
  let outOfStockCount = 0;

  for (const item of matrixItems) {
    totalStock += item.stock_quantity;
    if (item.stock_status === 'in_stock') inStockCount++;
    else if (item.stock_status === 'limited') limitedCount++;
    else outOfStockCount++;
  }

  return {
    totalStock,
    inStockCount,
    limitedCount,
    outOfStockCount,
  };
}
