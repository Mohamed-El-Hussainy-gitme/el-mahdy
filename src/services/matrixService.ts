import { ProductModelMatrixItem, StockStatus } from '@/types';

/**
 * Ensures the requested quantity strictly satisfies the model's MOQ and is a valid positive integer.
 */
export function enforceModelMOQ(quantity: number | string, moq: number | string = 1): number {
  const safeMoq = Math.max(1, Math.floor(Number(moq) || 1));
  const parsedQty = Number(quantity);

  if (isNaN(parsedQty) || !isFinite(parsedQty) || parsedQty <= 0) {
    return safeMoq;
  }

  const intQty = Math.floor(parsedQty);
  return Math.max(safeMoq, intQty);
}

/**
 * Calculates stock status based on actual quantity.
 */
export function calculateStockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= 10) return 'limited';
  return 'in_stock';
}

/**
 * Deducts stock officially when an order transitions from pending to preparation.
 */
export function deductStockForOrder(
  matrixItems: ProductModelMatrixItem[],
  itemsToDeduct: { model_id?: string; quantity: number }[]
): ProductModelMatrixItem[] {
  return matrixItems.map((matrixItem) => {
    const matchedItem = itemsToDeduct.find((it) => it.model_id === matrixItem.model_id);
    if (!matchedItem) return matrixItem;

    const newStock = Math.max(0, matrixItem.stock_quantity - matchedItem.quantity);
    return {
      ...matrixItem,
      stock_quantity: newStock,
      stock_status: calculateStockStatus(newStock),
    };
  });
}
