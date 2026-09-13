import { Category } from '@/types';

/**
 * Builds an infinite-level nested category tree from a flat category list using parent_id.
 */
export function buildCategoryTree(categories: Category[]): Category[] {
  const map = new Map<string, Category & { children: Category[] }>();
  const roots: Category[] = [];

  // Register all categories
  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  // Link children to their respective parents
  categories.forEach((cat) => {
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children.push(map.get(cat.id)!);
    } else {
      if (map.has(cat.id)) {
        roots.push(map.get(cat.id)!);
      }
    }
  });

  // Sort by sort_order
  roots.sort((a, b) => a.sort_order - b.sort_order);
  roots.forEach((root) => sortCategoryChildren(root));

  return roots;
}

function sortCategoryChildren(node: Category & { children?: Category[] }) {
  if (node.children && node.children.length > 0) {
    node.children.sort((a, b) => a.sort_order - b.sort_order);
    node.children.forEach((child) => sortCategoryChildren(child));
  }
}

/**
 * Validates if a category can be safely deleted without leaving orphan children,
 * and checks for any linked products to warn the administrator.
 */
export function validateCategoryDeletion(
  categories: Category[],
  id: string,
  products?: { category_ids?: string[] }[]
): { valid: boolean; reason?: string; linkedProductsCount?: number } {
  const hasChildren = categories.some((c) => c.parent_id === id);
  if (hasChildren) {
    return {
      valid: false,
      reason: 'لا يمكن حذف هذا التصنيف لأنه يحتوي على تصنيفات فرعية مسجلة تحته. يجب حذف أو نقل التصنيفات الفرعية أولاً.',
    };
  }

  const linkedProductsCount = products ? products.filter((p) => p.category_ids?.includes(id)).length : 0;

  return { valid: true, linkedProductsCount };
}

