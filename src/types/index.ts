export type UserRole = 'admin' | 'sales_agent' | 'warehouse_preparer' | 'customer' | string;

export interface CustomRole {
  id: string;
  name_ar: string;
  description?: string;
  is_system: boolean;
  can_manage_products: boolean;
  can_receive_customers: boolean;
  can_manage_orders: boolean;
  can_manage_categories: boolean;
  can_manage_matrix: boolean;
  can_manage_customers: boolean;
  can_manage_shortages: boolean;
  can_manage_settings: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name_ar: string;
  slug: string;
  icon?: string;
  image_url?: string | null;
  parent_id?: string | null;
  sort_order: number;
  is_active: boolean;
  product_count?: number;
  children?: Category[];
}

export interface MasterModel {
  id: string;
  brand: string;
  series?: string;
  model_name: string;
  release_year?: number;
}

export type StockStatus = 'in_stock' | 'limited' | 'out_of_stock';

export interface ProductModelMatrixItem {
  id: string;
  product_id: string;
  model_id: string;
  model?: MasterModel;
  stock_quantity: number;
  moq: number; // Minimum Order Quantity per model
  stock_status: StockStatus;
}

export interface Product {
  id: string;
  sku: string;
  title_ar: string;
  description_ar?: string;
  image_url: string;
  gallery_urls?: string[];
  price: number; // Single price for all
  cost_price?: number; // Internal cost price (Admin only)
  is_exchange_only: boolean; // "قابل للاستبدال فقط"
  is_featured: boolean;
  is_active: boolean;
  has_compatibility_matrix: boolean;
  category_ids: string[];
  matrix_items?: ProductModelMatrixItem[];
  available_models_count?: number;
  limited_models_count?: number;
}

export interface CartItem {
  product: Product;
  model?: MasterModel;
  quantity: number;
  unit_price: number;
  moq: number;
}

export type OrderStatus = 'pending' | 'preparation' | 'shipping' | 'delivered' | 'returned';

export type ReturnReason = 
  | 'customer_refused'
  | 'damaged_in_transit'
  | 'wrong_order'
  | 'wrong_model'
  | 'other';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  product_sku: string;
  model_id?: string;
  model_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_company?: string;
  sales_agent_id?: string;
  sales_agent_name?: string;
  sales_agent_phone?: string;
  status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  carrier_name?: string;
  waybill_number?: string;
  tracking_notes?: string;
  return_reason?: ReturnReason;
  return_notes?: string;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  confirmed_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  returned_at?: string;
}

export interface UserProfile {
  id: string;
  auth_user_id?: string;
  email?: string;
  full_name: string;
  phone: string;
  company_name?: string;
  city?: string;
  address?: string;
  role: UserRole;
  is_active?: boolean;
  assigned_sales_rep_id?: string;
  assigned_sales_rep_name?: string;
  assigned_sales_rep_phone?: string;
  custom_role_id?: string;
  custom_role_name?: string;
  custom_role?: CustomRole;
  created_at?: string;
}

export interface ShortageRequest {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  brand: string;
  model_name: string;
  notes?: string;
  status: 'pending' | 'reviewed';
  created_at: string;
}

export type AdjustmentType = 'surplus' | 'deficit' | 'damage' | 'correction' | 'return_stock';

export interface InventoryAdjustment {
  id: string;
  product_id: string;
  product_title?: string;
  product_sku?: string;
  model_id?: string;
  model_name?: string;
  adjusted_by?: string;
  adjuster_name?: string;
  adjustment_type: AdjustmentType;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  reason: string;
  created_at: string;
}

export interface StoreSettings {
  id?: string;
  store_name: string;
  tagline: string;
  address: string;
  phone: string;
  whatsapp_number: string;
  whatsapp_message: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  telegram_url: string;
  youtube_url: string;
  working_hours: string;
  announcement: string;
  default_moq: number;
  delivery_promise_1?: string;
  delivery_promise_2?: string;
  delivery_promise_3?: string;
  updated_at?: string;
}

