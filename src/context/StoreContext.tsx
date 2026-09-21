'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Product,
  Category,
  CartItem,
  Order,
  UserProfile,
  ShortageRequest,
  MasterModel,
  OrderStatus,
  ProductModelMatrixItem,
  StockStatus,
  UserRole,
  InventoryAdjustment,
  AdjustmentType,
  ReturnReason,
  StoreSettings,
  CustomRole,
  AssignmentType,
  SalesRepAssignment,
  SalesRepPerformanceReport,
} from '@/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { buildCategoryTree, validateCategoryDeletion } from '@/services/categoryService';
import { calculateStockStatus, deductStockForOrder, enforceModelMOQ } from '@/services/matrixService';
import { playOrderChime } from '@/lib/notificationSound';
import { normalizeEgyptianPhone, isValidEgyptianMobile } from '@/utils/phoneUtils';
import { auditLog, phoneHint, logOrderTransition } from '@/lib/logger';
import { clientCache, CACHE_KEYS, invalidateCatalogCache } from '@/lib/cache';



/**
 * Generates an RFC4122-compliant UUID v4.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Permanent Sticky Sales Representative for MH EL MAHDY B2B
export const DEFAULT_STICKY_SALES_REP: UserProfile = {
  id: '00000004-0000-0000-0000-000000000002',
  email: 'sales@elmahdy.com',
  full_name: 'أحمد محمود (مندوب المبيعات المعتمد)',
  phone: '201012345678',
  role: 'sales_agent',
};

export const DEFAULT_CUSTOM_ROLES: CustomRole[] = [
  {
    id: '00000008-0000-0000-0000-000000000001',
    name_ar: 'مدير النظام (Admin)',
    description: 'صلاحيات كاملة وغير مقيدة على كافة أقسام وإعدادات النظام',
    is_system: true,
    can_manage_products: true,
    can_receive_customers: true,
    can_manage_orders: true,
    can_manage_categories: true,
    can_manage_matrix: true,
    can_manage_customers: true,
    can_manage_shortages: true,
    can_manage_settings: true,
  },
  {
    id: '00000008-0000-0000-0000-000000000002',
    name_ar: 'مندوب مبيعات معتمد (Sales Agent)',
    description: 'استقبال ومتابعة العملاء والطلبات وتسجيل النواقص',
    is_system: true,
    can_manage_products: false,
    can_receive_customers: true,
    can_manage_orders: true,
    can_manage_categories: false,
    can_manage_matrix: false,
    can_manage_customers: true,
    can_manage_shortages: true,
    can_manage_settings: false,
  },
  {
    id: '00000008-0000-0000-0000-000000000003',
    name_ar: 'مسؤول المستودع والتجهيز (Warehouse)',
    description: 'تجهيز طلبيات الشحن ومطابقة المخزون ومصفوفة الموديلات',
    is_system: true,
    can_manage_products: false,
    can_receive_customers: false,
    can_manage_orders: true,
    can_manage_categories: false,
    can_manage_matrix: true,
    can_manage_customers: false,
    can_manage_shortages: false,
    can_manage_settings: false,
  },
];

interface StoreContextType {
  // Sync Status
  isLoading: boolean;
  refreshData: () => Promise<void>;

  // Categories & CRUD
  categories: Category[];
  categoriesTree: Category[];
  addCategory: (cat: { name_ar: string; slug: string; parent_id?: string | null; icon?: string; image_url?: string | null }) => Promise<void>;
  updateCategory: (id: string, cat: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<{ success: boolean; message?: string }>;
  selectedCategorySlug: string;
  setSelectedCategorySlug: (slug: string) => void;

  // Products & CRUD
  products: Product[];
  addProduct: (product: {
    sku: string;
    title_ar: string;
    description_ar?: string;
    price: number;
    cost_price?: number;
    image_url: string;
    gallery_urls?: string[];
    is_exchange_only: boolean;
    is_featured: boolean;
    has_compatibility_matrix: boolean;
    category_ids: string[];
  }) => Promise<Product>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<{ success: boolean; message?: string }>;
  toggleProductActive: (id: string, active: boolean) => Promise<void>;

  // Master Models & Compatibility Matrix CRUD
  masterModels: MasterModel[];
  addMasterModel: (model: { brand: string; series?: string; model_name: string; release_year?: number }) => Promise<MasterModel>;
  deleteMasterModel: (id: string) => Promise<void>;
  addModelToMatrix: (productId: string, modelId: string, stock: number, moq: number) => Promise<void>;
  bulkAddModelsToMatrix: (productId: string, items: Array<{ model_id: string; stock_quantity: number; moq: number }>) => Promise<void>;
  copyProductMatrix: (sourceProductId: string, targetProductId: string, overrideStock?: number) => Promise<void>;
  updateMatrixItem: (productId: string, matrixId: string, stock: number, moq: number, status: StockStatus) => Promise<void>;
  deleteMatrixItem: (productId: string, matrixId: string) => Promise<void>;

  // Inventory Adjustments
  inventoryAdjustments: InventoryAdjustment[];
  addInventoryAdjustment: (adj: {
    product_id: string;
    model_id?: string;
    adjustment_type: AdjustmentType;
    quantity_before: number;
    quantity_change: number;
    quantity_after: number;
    reason: string;
  }) => Promise<void>;

  // Filters
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedBrand: string | null;
  setSelectedBrand: (brand: string | null) => void;
  priceRange: [number, number];
  setPriceRange: (range: [number, number]) => void;
  onlyFeatured: boolean;
  setOnlyFeatured: (val: boolean) => void;
  clearFilters: () => void;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product, model?: MasterModel, quantity?: number) => void;
  removeFromCart: (productId: string, modelId?: string) => void;
  updateCartQuantity: (productId: string, quantity: number, modelId?: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartItemsCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  // Modals
  compatibilityProduct: Product | null;
  openCompatibilityModal: (product: Product) => void;
  closeCompatibilityModal: () => void;
  isShortageModalOpen: boolean;
  setIsShortageModalOpen: (open: boolean) => void;
  isAccountModalOpen: boolean;
  setIsAccountModalOpen: (open: boolean) => void;
  accountModalTab: 'menu' | 'login' | 'register' | 'orders';
  setAccountModalTab: (tab: 'menu' | 'login' | 'register' | 'orders') => void;
  openAccountModalWithTab: (tab: 'menu' | 'login' | 'register' | 'orders') => void;

  // Customer Auth (Sticky Rep & Separated Login / Registration)
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  loginCustomer: (phone: string) => Promise<{ success: boolean; message?: string; user?: UserProfile }>;
  registerCustomer: (name: string, phone: string, company?: string, address?: string, preferredSalesRepId?: string) => Promise<{ success: boolean; message?: string; user?: UserProfile }>;
  fetchCustomerOrders: (customerId?: string, phone?: string) => Promise<void>;
  logout: () => void;
  assignedSalesAgent: UserProfile;
  customers: UserProfile[];
  staffMembers: UserProfile[];
  salesRepAssignments: SalesRepAssignment[];
  assignCustomerSalesRep: (customerId: string, salesRepId: string, notes?: string, reassignPendingOrders?: boolean) => Promise<{ success: boolean; message?: string }>;
  customerChangeSalesRep: (preferredSalesRepId?: string, notes?: string) => Promise<{ success: boolean; message?: string }>;
  getLeastLoadedSalesRep: () => UserProfile | null;
  getSalesRepPerformanceReports: () => SalesRepPerformanceReport[];
  adminCreateCustomer: (data: { full_name: string; phone: string; company_name?: string; sales_rep_id?: string; notes?: string }) => Promise<{ success: boolean; message?: string; customer?: UserProfile }>;
  adminUpdateCustomer: (id: string, updates: { full_name?: string; phone?: string; company_name?: string; sales_rep_id?: string; is_active?: boolean; notes?: string }) => Promise<{ success: boolean; message?: string }>;
  adminToggleCustomerActive: (id: string, isActive: boolean) => Promise<{ success: boolean; message?: string }>;
  adminDeleteCustomer: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Custom Roles & Permissions Management (Admin)
  customRoles: CustomRole[];
  addCustomRole: (newRole: Omit<CustomRole, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; message?: string }>;
  updateCustomRole: (id: string, updates: Partial<CustomRole>) => Promise<{ success: boolean; message?: string }>;
  deleteCustomRole: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Staff / Admin Auth & RBAC
  staffSession: UserProfile | null;
  staffLogin: (email: string, pass: string) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  staffLogout: () => void;

  // Orders
  orders: Order[];
  placePendingOrder: (shippingAddress: string, notes?: string) => Promise<Order | null>;
  cancelCustomerOrder: (orderId: string, reason?: string) => Promise<{ success: boolean; message: string }>;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    trackingNotes?: string,
    carrierName?: string,
    waybillNumber?: string,
    returnReason?: ReturnReason,
    returnNotes?: string
  ) => Promise<void>;

  // Shortages
  shortages: ShortageRequest[];
  submitShortage: (brand: string, modelName: string, notes?: string) => Promise<void>;
  updateShortageStatus: (id: string, status: 'pending' | 'reviewed') => Promise<void>;

  // Comparison & Wishlist
  compareList: Product[];
  toggleCompare: (product: Product) => void;
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isWishlistOpen: boolean;
  setIsWishlistOpen: (open: boolean) => void;
  clearWishlist: () => void;

  // Store Settings
  storeSettings: StoreSettings;
  updateStoreSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Pure state initialization — starts empty and hydrates live from Supabase
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [masterModels, setMasterModels] = useState<MasterModel[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shortages, setShortages] = useState<ShortageRequest[]>([]);
  const [inventoryAdjustments, setInventoryAdjustments] = useState<InventoryAdjustment[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [staffMembers, setStaffMembers] = useState<UserProfile[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>(DEFAULT_CUSTOM_ROLES);
  const [salesRepAssignments, setSalesRepAssignments] = useState<SalesRepAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all-products');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 7500]);
  const [onlyFeatured, setOnlyFeatured] = useState<boolean>(false);

  // Modals
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);
  const [compatibilityProduct, setCompatibilityProduct] = useState<Product | null>(null);
  const [isShortageModalOpen, setIsShortageModalOpen] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [accountModalTab, setAccountModalTab] = useState<'menu' | 'login' | 'register' | 'orders'>('menu');
  const openAccountModalWithTab = (tab: 'menu' | 'login' | 'register' | 'orders') => {
    setAccountModalTab(tab);
    setIsAccountModalOpen(true);
  };

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer Auth
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const assignedSalesAgent = DEFAULT_STICKY_SALES_REP;

  // Staff / Admin Auth Session (hydrated safely in useEffect after mount)
  const [staffSession, setStaffSession] = useState<UserProfile | null>(null);

  // Compare & Wishlist
  const [compareList, setCompareList] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);

  // Store Settings
  const defaultSettings: StoreSettings = {
    store_name: 'MH EL MAHDY - متجر المهدي للتجارة والتوزيع',
    tagline: 'المنظومة المعتمدة لتوزيع إكسسوارات الهواتف وحماية الشاشات والملحقات الأصلية لقطاع الأعمال والشركات.',
    address: 'القاهرة - وسط البلد - شارع عبد العزيز / المستودع المركزي بمدينة نصر',
    phone: '01012345678',
    whatsapp_number: '201012345678',
    whatsapp_message: 'السلام عليكم، أرغب في الاستفسار عن طلب توريد بالجملة من متجر MH EL MAHDY',
    facebook_url: 'https://facebook.com/mhelmahdy',
    instagram_url: 'https://instagram.com/mhelmahdy',
    tiktok_url: 'https://tiktok.com/@mhelmahdy',
    telegram_url: 'https://t.me/mhelmahdy',
    youtube_url: 'https://youtube.com/@mhelmahdy',
    working_hours: 'السبت - الخميس: 9:00 ص - 10:00 م',
    announcement: 'شحن فوري وتوصيل لكافة محافظات الجمهورية للمحلات والشركات مع إصدار بوليصة شحن وتتبع مباشر.',
    default_moq: 5,
    delivery_promise_1: 'توصيل لكافة محافظات جمهورية مصر العربية للمحلات والشركات.',
    delivery_promise_2: 'تجهيز وشحن الطلبات بالتنسيق مع المندوب المعتمد ومسؤولي المستودع.',
    delivery_promise_3: 'إصدار بوليصة شحن ومتابعة حالة الطلب لكل بضاعة تجارية.',
  };
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultSettings);

  // 1. Refresh Data callback for live sync from Supabase
  const refreshData = useCallback(async () => {
    setIsLoading(true);

    // Restore user/cart from localStorage (non-sensitive)
    try {
      const savedUser = localStorage.getItem('mh_mahdy_user');
      if (savedUser) setCurrentUser(JSON.parse(savedUser));

      const savedCart = localStorage.getItem('mh_mahdy_cart');
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedStaff = localStorage.getItem('mh_mahdy_staff');
      if (savedStaff) {
        const parsedStaff = JSON.parse(savedStaff);
        if (parsedStaff && parsedStaff.role !== 'customer') {
          setStaffSession(parsedStaff);
        }
      }

      const savedWish = localStorage.getItem('mh_mahdy_wishlist');
      if (savedWish) setWishlist(JSON.parse(savedWish));

      const savedAssignments = localStorage.getItem('mh_mahdy_rep_assignments');
      if (savedAssignments) setSalesRepAssignments(JSON.parse(savedAssignments));

      const savedCustomers = localStorage.getItem('mh_mahdy_customers');
      if (savedCustomers) setCustomers(JSON.parse(savedCustomers));

      const savedStaffList = localStorage.getItem('mh_mahdy_staff_list');
      if (savedStaffList) {
        setStaffMembers(JSON.parse(savedStaffList));
      } else {
        setStaffMembers([DEFAULT_STICKY_SALES_REP]);
      }
    } catch (e) {
      console.warn('Storage read warning:', e);
    }

    // Validate staff session via Supabase Auth (authoritative source)
    if (isSupabaseConfigured()) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          let { data: profile } = await supabase
            .from('user_profiles')
            .select('*, custom_role:custom_roles(*)')
            .eq('auth_user_id', session.user.id)
            .maybeSingle();

          // Fallback: match by email if auth_user_id link is pending
          if (!profile && session.user.email) {
            const { data: byEmail } = await supabase
              .from('user_profiles')
              .select('*, custom_role:custom_roles(*)')
              .eq('email', session.user.email)
              .maybeSingle();
            if (byEmail) {
              profile = byEmail;
              await supabase
                .from('user_profiles')
                .update({ auth_user_id: session.user.id })
                .eq('id', byEmail.id);
            }
          }

          if (profile && profile.role !== 'customer' && profile.is_active !== false) {
            setStaffSession(profile);
            localStorage.setItem('mh_mahdy_staff', JSON.stringify(profile));
          } else if (profile && (profile.role === 'customer' || profile.is_active === false)) {
            // Profile is explicitly forbidden
            setStaffSession(null);
            localStorage.removeItem('mh_mahdy_staff');
          }
        }
        // If session is null, do NOT wipe staffSession — keep cached session from localStorage!
      } catch (authCheckErr) {
        console.warn('Auth session check failed (retaining cached session):', authCheckErr);
      }
    }

    if (!isSupabaseConfigured()) {
      // Offline fallback
      try {
        const cachedCats = localStorage.getItem('mh_mahdy_categories');
        if (cachedCats) setCategories(JSON.parse(cachedCats));

        const cachedProds = localStorage.getItem('mh_mahdy_products');
        if (cachedProds) setProducts(JSON.parse(cachedProds));

        const cachedModels = localStorage.getItem('mh_mahdy_models');
        if (cachedModels) setMasterModels(JSON.parse(cachedModels));

        const cachedOrders = localStorage.getItem('mh_mahdy_orders');
        if (cachedOrders) setOrders(JSON.parse(cachedOrders));

        const cachedShortages = localStorage.getItem('mh_mahdy_shortages');
        if (cachedShortages) setShortages(JSON.parse(cachedShortages));
      } catch {}
      setIsLoading(false);
      return;
    }

    try {
      // ── Check in-memory cache first ──────────────────────────────────────
      const cachedCategories = clientCache.get<typeof dbCategories>(CACHE_KEYS.CATEGORIES);
      const cachedModels = clientCache.get<typeof dbModels>(CACHE_KEYS.MODELS);
      const cachedProducts = clientCache.get<any[]>(CACHE_KEYS.PRODUCTS);

      // Categories
      let dbCategories: any[] | null = cachedCategories ?? null;
      if (!dbCategories) {
        const { data } = await supabase.from('categories').select('*').order('sort_order');
        dbCategories = data;
        if (dbCategories && dbCategories.length > 0) clientCache.set(CACHE_KEYS.CATEGORIES, dbCategories);
      }
      if (dbCategories && dbCategories.length > 0) {
        setCategories(dbCategories);
        try { localStorage.setItem('mh_mahdy_categories', JSON.stringify(dbCategories)); } catch {}
      }


      // Master Models
      let dbModels: any[] | null = cachedModels ?? null;
      if (!dbModels) {
        const { data } = await supabase
          .from('master_models')
          .select('*')
          .order('brand', { ascending: true })
          .order('model_name', { ascending: true });
        dbModels = data;
        if (dbModels && dbModels.length > 0) clientCache.set(CACHE_KEYS.MODELS, dbModels);
      }
      if (dbModels && dbModels.length > 0) {
        setMasterModels(dbModels);
        try { localStorage.setItem('mh_mahdy_models', JSON.stringify(dbModels)); } catch {}
      }

      // Products + Categories + Matrix — fetch in parallel, skip if cached
      let assembledFromCache = false;
      if (cachedProducts && cachedProducts.length > 0) {
        setProducts(cachedProducts);
        assembledFromCache = true;
      }

      if (!assembledFromCache) {
        const [
          { data: dbProducts },
          { data: dbProdCats },
          { data: dbMatrix },
        ] = await Promise.all([
          supabase.from('products').select('*').order('created_at', { ascending: false }),
          supabase.from('product_categories').select('*'),
          supabase.from('product_model_matrix').select('*, master_models(*)'),
        ]);

        if (dbProducts && dbProducts.length > 0) {
          const assembledProducts: Product[] = dbProducts.map((p) => {
            const catIds = dbProdCats
              ? dbProdCats
                  .filter((pc: { product_id: string }) => pc.product_id === p.id)
                  .map((pc: { category_id: string }) => pc.category_id)
              : [];

            const matrixItems: ProductModelMatrixItem[] = dbMatrix
              ? dbMatrix
                  .filter((m: { product_id: string }) => m.product_id === p.id)
                  .map((m: {
                    id: string;
                    product_id: string;
                    model_id: string;
                    stock_quantity: number;
                    moq: number;
                    stock_status: StockStatus;
                    master_models?: MasterModel;
                  }) => ({
                    id: m.id,
                    product_id: m.product_id,
                    model_id: m.model_id,
                    stock_quantity: m.stock_quantity,
                    moq: m.moq,
                    stock_status: m.stock_status,
                    model: m.master_models,
                  }))
              : [];

            return {
              ...p,
              price: Number(p.price),
              cost_price: p.cost_price ? Number(p.cost_price) : 0,
              gallery_urls: p.gallery_urls || [],
              category_ids: catIds,
              matrix_items: matrixItems,
              available_models_count: matrixItems.filter((m) => m.stock_quantity > 0).length,
              limited_models_count: matrixItems.filter((m) => m.stock_status === 'limited').length,
            };
          });

          setProducts(assembledProducts);
          clientCache.set(CACHE_KEYS.PRODUCTS, assembledProducts);
          try { localStorage.setItem('mh_mahdy_products', JSON.stringify(assembledProducts)); } catch {}
        }
      }

      // Orders + Order Items + User Profile
      let dbOrders: any[] | null = null;
      try {
        const { data, error: oErr } = await supabase
          .from('orders')
          .select(`
            *,
            order_items(*, products(title_ar, sku), master_models(model_name)),
            customer:user_profiles!customer_id(full_name, phone, company_name),
            sales_agent:user_profiles!sales_agent_id(full_name, phone)
          `)
          .order('created_at', { ascending: false });

        if (oErr) {
          console.warn('Orders join query error, falling back to simple select:', oErr);
          const { data: simpleData } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .order('created_at', { ascending: false });
          dbOrders = simpleData;
        } else {
          dbOrders = data;
        }
      } catch (err) {
        console.warn('Orders fetch caught error:', err);
      }

      if (dbOrders) {
        const assembledOrders: Order[] = dbOrders.map((o: {
          id: string;
          order_number: string;
          customer_id: string;
          sales_agent_id?: string;
          status: OrderStatus;
          total_amount: number;
          shipping_address: string;
          carrier_name?: string;
          waybill_number?: string;
          tracking_notes?: string;
          return_reason?: ReturnReason;
          return_notes?: string;
          notes?: string;
          created_at: string;
          confirmed_at?: string;
          shipped_at?: string;
          delivered_at?: string;
          returned_at?: string;
          customer?: { full_name: string; phone: string; company_name?: string };
          sales_agent?: { full_name: string; phone: string };
          order_items?: Array<{
            id: string;
            order_id: string;
            product_id: string;
            model_id?: string;
            quantity: number;
            unit_price: number;
            subtotal: number;
            products?: { title_ar: string; sku: string };
            master_models?: { model_name: string };
          }>;
        }) => ({
          id: o.id,
          order_number: o.order_number,
          customer_id: o.customer_id,
          customer_name: o.customer?.full_name || 'عميل تجاري',
          customer_phone: o.customer?.phone || '',
          customer_company: o.customer?.company_name,
          sales_agent_id: o.sales_agent_id || undefined,
          sales_agent_name: o.sales_agent?.full_name || (o.sales_agent_id ? 'مندوب مبيعات' : undefined),
          sales_agent_phone: o.sales_agent?.phone || undefined,
          status: o.status,
          total_amount: Number(o.total_amount),
          shipping_address: o.shipping_address,
          carrier_name: o.carrier_name,
          waybill_number: o.waybill_number,
          tracking_notes: o.tracking_notes,
          return_reason: o.return_reason,
          return_notes: o.return_notes,
          notes: o.notes,
          created_at: o.created_at,
          confirmed_at: o.confirmed_at,
          shipped_at: o.shipped_at,
          delivered_at: o.delivered_at,
          returned_at: o.returned_at,
          items: (o.order_items || []).map((it) => ({
            id: it.id,
            order_id: it.order_id,
            product_id: it.product_id,
            product_title: it.products?.title_ar || 'منتج',
            product_sku: it.products?.sku || '',
            model_id: it.model_id,
            model_name: it.master_models?.model_name,
            quantity: it.quantity,
            unit_price: Number(it.unit_price),
            subtotal: Number(it.subtotal),
          })),
        }));

        setOrders(assembledOrders);
        try { localStorage.setItem('mh_mahdy_orders', JSON.stringify(assembledOrders)); } catch {}
      }

      // For customer (non-staff), securely load their own orders via RPC
      if (!staffSession && currentUser?.id && currentUser?.phone) {
        await fetchCustomerOrders(currentUser.id, currentUser.phone);
      }

      // Shortage Requests
      const { data: dbShortages } = await supabase
        .from('shortage_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbShortages && dbShortages.length > 0) {
        setShortages(dbShortages);
        try { localStorage.setItem('mh_mahdy_shortages', JSON.stringify(dbShortages)); } catch {}
      }

      // Customers List
      let custList: UserProfile[] = [];
      const { data: dbCustomers } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'customer')
        .order('created_at', { ascending: false });
      if (dbCustomers && dbCustomers.length > 0) {
        custList = dbCustomers as UserProfile[];
      } else {
        // Fallback to security definer RPC sp_admin_get_customers
        try {
          const { data: rpcCustomers } = await supabase.rpc('sp_admin_get_customers');
          if (rpcCustomers && rpcCustomers.length > 0) {
            custList = rpcCustomers as UserProfile[];
          }
        } catch (rpcErr) {
          console.warn('sp_admin_get_customers RPC notice:', rpcErr);
        }
      }
      if (custList.length > 0) {
        setCustomers(custList);
        try { localStorage.setItem('mh_mahdy_customers', JSON.stringify(custList)); } catch {}
      }

      // Staff Members List (Admin, Sales, Warehouse, or any custom role staff)
      let staffList: UserProfile[] = [];
      try {
        const { data: dbStaff, error: dbStaffErr } = await supabase
          .from('user_profiles')
          .select('*, custom_role:custom_roles(*)')
          .neq('role', 'customer')
          .order('created_at', { ascending: true });
        if (dbStaff && dbStaff.length > 0) {
          staffList = dbStaff as UserProfile[];
        }
      } catch {}

      // Fallback 1: Plain query without join in case custom_roles RLS prevents joined select
      if (staffList.length === 0) {
        try {
          const { data: plainStaff } = await supabase
            .from('user_profiles')
            .select('*')
            .neq('role', 'customer')
            .order('created_at', { ascending: true });
          if (plainStaff && plainStaff.length > 0) {
            staffList = plainStaff as UserProfile[];
          }
        } catch {}
      }

      // Fallback 2: Security Definer RPC for public/customer context
      if (staffList.length === 0) {
        try {
          const { data: rpcStaff } = await supabase.rpc('sp_get_active_sales_reps');
          if (rpcStaff && rpcStaff.length > 0) {
            staffList = rpcStaff.map((s: any) => ({
              id: s.id,
              full_name: s.full_name,
              phone: s.phone,
              role: s.role || 'sales_agent',
              custom_role_name: s.custom_role_name,
              custom_role: { can_receive_customers: true, name_ar: s.custom_role_name } as any,
              is_active: true,
            }));
          }
        } catch (rpcErr) {
          console.warn('sp_get_active_sales_reps notice:', rpcErr);
        }
      }

      if (staffList.length > 0) {
        setStaffMembers(staffList);
        try { localStorage.setItem('mh_mahdy_staff_list', JSON.stringify(staffList)); } catch {}
      } else {
        // Fallback 3: check localStorage cache
        const cachedStaff = typeof window !== 'undefined' ? localStorage.getItem('mh_mahdy_staff_list') : null;
        if (cachedStaff) {
          try {
            const parsed = JSON.parse(cachedStaff);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setStaffMembers(parsed);
            } else {
              setStaffMembers([DEFAULT_STICKY_SALES_REP]);
            }
          } catch {
            setStaffMembers([DEFAULT_STICKY_SALES_REP]);
          }
        } else {
          setStaffMembers([DEFAULT_STICKY_SALES_REP]);
        }
      }


      // Custom Roles List
      const { data: dbRoles } = await supabase
        .from('custom_roles')
        .select('*')
        .order('created_at', { ascending: true });
      if (dbRoles && dbRoles.length > 0) {
        setCustomRoles(dbRoles as CustomRole[]);
      }

      // Sales Rep Assignments Data Log
      const { data: dbAssignments } = await supabase
        .from('sales_rep_assignments')
        .select('*')
        .order('created_at', { ascending: false });
      if (dbAssignments) {
        setSalesRepAssignments(dbAssignments as SalesRepAssignment[]);
        try { localStorage.setItem('mh_mahdy_rep_assignments', JSON.stringify(dbAssignments)); } catch {}
      }

      // Inventory Adjustments
      const { data: dbAdjustments } = await supabase
        .from('inventory_adjustments')
        .select('*, products(title_ar, sku), master_models(model_name), user_profiles(full_name)')
        .order('created_at', { ascending: false });
      if (dbAdjustments) {
        const mappedAdj: InventoryAdjustment[] = dbAdjustments.map((a: {
          id: string;
          product_id: string;
          model_id?: string;
          adjusted_by?: string;
          adjustment_type: AdjustmentType;
          quantity_before: number;
          quantity_change: number;
          quantity_after: number;
          reason: string;
          created_at: string;
          products?: { title_ar: string; sku: string };
          master_models?: { model_name: string };
          user_profiles?: { full_name: string };
        }) => ({
          id: a.id,
          product_id: a.product_id,
          product_title: a.products?.title_ar,
          product_sku: a.products?.sku,
          model_id: a.model_id,
          model_name: a.master_models?.model_name,
          adjusted_by: a.adjusted_by,
          adjuster_name: a.user_profiles?.full_name,
          adjustment_type: a.adjustment_type,
          quantity_before: a.quantity_before,
          quantity_change: a.quantity_change,
          quantity_after: a.quantity_after,
          reason: a.reason,
          created_at: a.created_at,
        }));
        setInventoryAdjustments(mappedAdj);
      }
    } catch (err) {
      console.warn('Supabase fetch error:', err);
    } finally {
      setIsLoading(false);
    }

    // Fetch store settings separately (non-critical, don't let it block the main data)
    try {
      const { data: dbSettings } = await supabase
        .from('store_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();
      if (dbSettings) {
        setStoreSettings({ ...defaultSettings, ...dbSettings });
      }
    } catch {
      // store_settings table may not exist yet — use defaults silently
    }
  }, []);

  // Update Store Settings (Admin action — persists to Supabase)
  const updateStoreSettings = useCallback(async (newSettings: Partial<StoreSettings>) => {
    const merged: StoreSettings = { ...storeSettings, ...newSettings };
    setStoreSettings(merged);
    if (isSupabaseConfigured()) {
      await supabase
        .from('store_settings')
        .upsert({ id: 'default', ...merged, updated_at: new Date().toISOString() });
    }
  }, [storeSettings]);

  // Initial Load + Realtime Listener
  useEffect(() => {
    refreshData();

    if (isSupabaseConfigured()) {
      const ordersChannel = supabase
        .channel('live-orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            playOrderChime();
          }
          refreshData();
        })
        .subscribe();

      const shortagesChannel = supabase
        .channel('live-shortages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shortage_requests' }, () => {
          refreshData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(ordersChannel);
        supabase.removeChannel(shortagesChannel);
      };
    }
  }, [refreshData]);

  // Persist state changes locally for cache/offline resilience
  useEffect(() => {
    try { localStorage.setItem('mh_mahdy_categories', JSON.stringify(categories)); } catch {}
  }, [categories]);

  useEffect(() => {
    try { localStorage.setItem('mh_mahdy_products', JSON.stringify(products)); } catch {}
  }, [products]);

  useEffect(() => {
    try { localStorage.setItem('mh_mahdy_models', JSON.stringify(masterModels)); } catch {}
  }, [masterModels]);

  useEffect(() => {
    try { localStorage.setItem('mh_mahdy_orders', JSON.stringify(orders)); } catch {}
  }, [orders]);

  useEffect(() => {
    try { localStorage.setItem('mh_mahdy_shortages', JSON.stringify(shortages)); } catch {}
  }, [shortages]);

  useEffect(() => {
    try { localStorage.setItem('mh_mahdy_cart', JSON.stringify(cart)); } catch {}
  }, [cart]);

  // Categories Tree computation (Infinite parent -> children hierarchy)
  const categoriesTree = useMemo(() => {
    return buildCategoryTree(categories);
  }, [categories]);

  // ==========================================
  // Category Tree CRUD
  // ==========================================
  const addCategory = async (cat: { name_ar: string; slug: string; parent_id?: string | null; icon?: string; image_url?: string | null }) => {
    const newCatId = generateUUID();
    const newCat: Category = {
      id: newCatId,
      name_ar: cat.name_ar,
      slug: cat.slug || 'cat-' + Date.now(),
      parent_id: cat.parent_id || null,
      icon: cat.icon || '',
      image_url: cat.image_url || '',
      sort_order: categories.length + 1,
      is_active: true,
      product_count: 0,
    };

    setCategories((prev) => [...prev, newCat]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('categories').insert({
          id: newCat.id,
          name_ar: newCat.name_ar,
          slug: newCat.slug,
          parent_id: newCat.parent_id,
          icon: newCat.icon,
          image_url: newCat.image_url || null,
          sort_order: newCat.sort_order,
          is_active: newCat.is_active,
        });
      } catch (err) {
        console.warn('Supabase addCategory sync error:', err);
      }
    }
  };

  const getAuthToken = async () => {
    if (!isSupabaseConfigured()) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const updateCategory = async (id: string, updated: Partial<Category>) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? {
        ...c,
        ...updated,
        image_url: updated.image_url !== undefined ? (updated.image_url || undefined) : c.image_url,
      } : c))
    );

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('categories')
          .update({
            ...(updated.name_ar && { name_ar: updated.name_ar }),
            ...(updated.slug && { slug: updated.slug }),
            ...(updated.parent_id !== undefined && { parent_id: updated.parent_id }),
            ...(updated.icon !== undefined && { icon: updated.icon }),
            ...(updated.image_url !== undefined && { image_url: updated.image_url || null }),
            ...(updated.sort_order !== undefined && { sort_order: updated.sort_order }),
            ...(updated.is_active !== undefined && { is_active: updated.is_active }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase updateCategory sync error:', err);
      }
    }
  };

  const deleteCategory = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const validation = validateCategoryDeletion(categories, id, products);
    if (!validation.valid) {
      return { success: false, message: validation.reason };
    }

    const previousCategories = categories;
    setCategories((prev) => prev.filter((c) => c.id !== id));

    if (isSupabaseConfigured()) {
      try {
        const token = await getAuthToken();
        if (token) {
          const res = await fetch(`/api/admin/categories?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          const resData = await res.json();
          if (!res.ok || !resData.success) {
            setCategories(previousCategories);
            return { success: false, message: resData.error || 'فشل حذف التصنيف من الخادم' };
          }
        } else {
          await supabase.from('product_categories').delete().eq('category_id', id);
          await supabase.from('categories').update({ parent_id: null }).eq('parent_id', id);
          const { error } = await supabase.from('categories').delete().eq('id', id);
          if (error) {
            setCategories(previousCategories);
            return { success: false, message: error.message };
          }
        }
      } catch (err: unknown) {
        setCategories(previousCategories);
        return { success: false, message: err instanceof Error ? err.message : 'حدث خطأ أثناء حذف التصنيف' };
      }
    }

    return { success: true };
  };

  // ==========================================
  // Products CRUD
  // ==========================================
  const addProduct = async (productData: {
    sku: string;
    title_ar: string;
    description_ar?: string;
    price: number;
    cost_price?: number;
    image_url: string;
    gallery_urls?: string[];
    is_exchange_only: boolean;
    is_featured: boolean;
    has_compatibility_matrix: boolean;
    category_ids: string[];
  }): Promise<Product> => {
    const newProdId = generateUUID();
    const newProduct: Product = {
      id: newProdId,
      sku: productData.sku,
      title_ar: productData.title_ar,
      description_ar: productData.description_ar,
      price: productData.price,
      cost_price: productData.cost_price || 0,
      image_url: productData.image_url || '/logo.png',
      gallery_urls: productData.gallery_urls || [],
      is_exchange_only: productData.is_exchange_only,
      is_featured: productData.is_featured,
      is_active: true,
      has_compatibility_matrix: productData.has_compatibility_matrix,
      category_ids: productData.category_ids.length > 0 ? productData.category_ids : [categories[0]?.id || '00000001-0000-0000-0000-000000000001'],
      matrix_items: [],
      available_models_count: 0,
    };

    setProducts((prev) => [newProduct, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('products').insert({
          id: newProdId,
          sku: newProduct.sku,
          title_ar: newProduct.title_ar,
          description_ar: newProduct.description_ar || null,
          price: newProduct.price,
          cost_price: newProduct.cost_price,
          image_url: newProduct.image_url,
          gallery_urls: newProduct.gallery_urls,
          is_exchange_only: newProduct.is_exchange_only,
          is_featured: newProduct.is_featured,
          is_active: true,
          has_compatibility_matrix: newProduct.has_compatibility_matrix,
        });

        if (newProduct.category_ids.length > 0) {
          const catLinks = newProduct.category_ids.map((catId) => ({
            product_id: newProdId,
            category_id: catId,
          }));
          await supabase.from('product_categories').insert(catLinks);
        }
      } catch (err) {
        console.warn('Supabase addProduct sync error:', err);
      }
    }

    invalidateCatalogCache();
    return newProduct;
  };

  const updateProduct = async (id: string, updated: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
    );

    if (isSupabaseConfigured()) {
      try {
        const dbPayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (updated.sku !== undefined) dbPayload.sku = updated.sku;
        if (updated.title_ar !== undefined) dbPayload.title_ar = updated.title_ar;
        if (updated.description_ar !== undefined) dbPayload.description_ar = updated.description_ar;
        if (updated.price !== undefined) dbPayload.price = updated.price;
        if (updated.cost_price !== undefined) dbPayload.cost_price = updated.cost_price;
        if (updated.image_url !== undefined) dbPayload.image_url = updated.image_url || null;
        if (updated.gallery_urls !== undefined) dbPayload.gallery_urls = updated.gallery_urls;
        if (updated.is_exchange_only !== undefined) dbPayload.is_exchange_only = updated.is_exchange_only;
        if (updated.is_featured !== undefined) dbPayload.is_featured = updated.is_featured;
        if (updated.is_active !== undefined) dbPayload.is_active = updated.is_active;
        if (updated.has_compatibility_matrix !== undefined) dbPayload.has_compatibility_matrix = updated.has_compatibility_matrix;

        await supabase.from('products').update(dbPayload).eq('id', id);

        if (updated.category_ids) {
          await supabase.from('product_categories').delete().eq('product_id', id);
          const catLinks = updated.category_ids.map((catId) => ({
            product_id: id,
            category_id: catId,
          }));
          await supabase.from('product_categories').insert(catLinks);
        }
      } catch (err) {
        console.warn('Supabase updateProduct sync error:', err);
      }
    }
    invalidateCatalogCache();
  };

  const toggleProductActive = async (id: string, active: boolean) => {
    await updateProduct(id, { is_active: active });
  };

  const deleteProduct = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const previousProducts = products;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    invalidateCatalogCache();

    if (isSupabaseConfigured()) {
      try {
        const token = await getAuthToken();
        if (token) {
          const res = await fetch(`/api/admin/products?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          const resData = await res.json();
          if (!res.ok || !resData.success) {
            setProducts(previousProducts);
            invalidateCatalogCache();
            return { success: false, message: resData.error || 'فشل مسح المنتج من الخادم' };
          }
        } else {
          await supabase.from('product_categories').delete().eq('product_id', id);
          await supabase.from('product_model_matrix').delete().eq('product_id', id);
          const { error } = await supabase.from('products').delete().eq('id', id);
          if (error) {
            setProducts(previousProducts);
            invalidateCatalogCache();
            return { success: false, message: error.message };
          }
        }
      } catch (err: unknown) {
        setProducts(previousProducts);
        invalidateCatalogCache();
        return { success: false, message: err instanceof Error ? err.message : 'حدث خطأ أثناء مسح المنتج' };
      }
    }

    return { success: true };
  };

  // ==========================================
  // Master Models & Compatibility Matrix CRUD
  // ==========================================
  const addMasterModel = async (modelData: {
    brand: string;
    series?: string;
    model_name: string;
    release_year?: number;
  }): Promise<MasterModel> => {
    const newModelId = generateUUID();
    const newModel: MasterModel = {
      id: newModelId,
      brand: modelData.brand.toUpperCase(),
      series: modelData.series,
      model_name: modelData.model_name,
      release_year: modelData.release_year || new Date().getFullYear(),
    };

    setMasterModels((prev) => [...prev, newModel]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('master_models').insert({
          id: newModelId,
          brand: newModel.brand,
          series: newModel.series || null,
          model_name: newModel.model_name,
          release_year: newModel.release_year,
        });
      } catch (err) {
        console.warn('Supabase addMasterModel error:', err);
      }
    }

    return newModel;
  };

  const deleteMasterModel = async (id: string) => {
    setMasterModels((prev) => prev.filter((m) => m.id !== id));
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('master_models').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase deleteMasterModel error:', err);
      }
    }
  };

  const addModelToMatrix = async (
    productId: string,
    modelId: string,
    stock: number,
    moq: number
  ) => {
    const model = masterModels.find((m) => m.id === modelId);
    if (!model) return;

    const matrixItemId = generateUUID();
    const status: StockStatus = calculateStockStatus(stock);

    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id !== productId) return prod;

        const currentMatrix = prod.matrix_items || [];
        const existingIdx = currentMatrix.findIndex((item) => item.model_id === modelId);

        let updatedMatrix: ProductModelMatrixItem[];
        if (existingIdx > -1) {
          updatedMatrix = [...currentMatrix];
          updatedMatrix[existingIdx] = {
            ...updatedMatrix[existingIdx],
            stock_quantity: stock,
            moq: moq,
            stock_status: status,
          };
        } else {
          updatedMatrix = [
            ...currentMatrix,
            {
              id: matrixItemId,
              product_id: productId,
              model_id: modelId,
              model: model,
              stock_quantity: stock,
              moq: moq,
              stock_status: status,
            },
          ];
        }

        return {
          ...prod,
          has_compatibility_matrix: true,
          matrix_items: updatedMatrix,
          available_models_count: updatedMatrix.filter((m) => m.stock_quantity > 0).length,
        };
      })
    );

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('product_model_matrix').upsert({
          product_id: productId,
          model_id: modelId,
          stock_quantity: stock,
          moq: moq,
          stock_status: status,
        }, { onConflict: 'product_id,model_id' });
      } catch (err) {
        console.warn('Supabase addModelToMatrix error:', err);
      }
    }
  };

  // Bulk Add models to matrix in a single batch
  const bulkAddModelsToMatrix = async (
    productId: string,
    items: Array<{ model_id: string; stock_quantity: number; moq: number }>
  ) => {
    if (items.length === 0) return;

    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id !== productId) return prod;
        const currentMatrix = prod.matrix_items || [];
        const newMatrix = [...currentMatrix];

        for (const it of items) {
          const m = masterModels.find((mod) => mod.id === it.model_id);
          const idx = newMatrix.findIndex((item) => item.model_id === it.model_id);
          const status = calculateStockStatus(it.stock_quantity);

          if (idx > -1) {
            newMatrix[idx] = {
              ...newMatrix[idx],
              stock_quantity: it.stock_quantity,
              moq: it.moq,
              stock_status: status,
            };
          } else {
            newMatrix.push({
              id: generateUUID(),
              product_id: productId,
              model_id: it.model_id,
              model: m,
              stock_quantity: it.stock_quantity,
              moq: it.moq,
              stock_status: status,
            });
          }
        }

        return {
          ...prod,
          has_compatibility_matrix: true,
          matrix_items: newMatrix,
          available_models_count: newMatrix.filter((x) => x.stock_quantity > 0).length,
        };
      })
    );

    if (isSupabaseConfigured()) {
      try {
        const payload = items.map((it) => ({
          product_id: productId,
          model_id: it.model_id,
          stock_quantity: it.stock_quantity,
          moq: it.moq,
          stock_status: calculateStockStatus(it.stock_quantity),
        }));
        await supabase.from('product_model_matrix').upsert(payload, { onConflict: 'product_id,model_id' });
      } catch (err) {
        console.warn('Supabase bulkAddModelsToMatrix error:', err);
      }
    }
  };

  // Copy matrix models from another product
  const copyProductMatrix = async (sourceProductId: string, targetProductId: string, overrideStock?: number) => {
    const source = products.find((p) => p.id === sourceProductId);
    if (!source || !source.matrix_items || source.matrix_items.length === 0) return;

    const itemsToCopy = source.matrix_items.map((m) => ({
      model_id: m.model_id,
      stock_quantity: overrideStock !== undefined ? overrideStock : m.stock_quantity,
      moq: m.moq,
    }));

    await bulkAddModelsToMatrix(targetProductId, itemsToCopy);
  };

  const updateMatrixItem = async (
    productId: string,
    matrixId: string,
    stock: number,
    moq: number,
    status: StockStatus
  ) => {
    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id !== productId || !prod.matrix_items) return prod;

        const updatedMatrix = prod.matrix_items.map((item) => {
          if (item.id === matrixId) {
            return {
              ...item,
              stock_quantity: stock,
              moq: moq,
              stock_status: status,
            };
          }
          return item;
        });

        return {
          ...prod,
          matrix_items: updatedMatrix,
          available_models_count: updatedMatrix.filter((m) => m.stock_quantity > 0).length,
        };
      })
    );

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('product_model_matrix')
          .update({
            stock_quantity: stock,
            moq: moq,
            stock_status: status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', matrixId);
      } catch (err) {
        console.warn('Supabase updateMatrixItem error:', err);
      }
    }
  };

  const deleteMatrixItem = async (productId: string, matrixId: string) => {
    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id !== productId || !prod.matrix_items) return prod;

        const updatedMatrix = prod.matrix_items.filter((item) => item.id !== matrixId);
        return {
          ...prod,
          matrix_items: updatedMatrix,
          has_compatibility_matrix: updatedMatrix.length > 0,
          available_models_count: updatedMatrix.filter((m) => m.stock_quantity > 0).length,
        };
      })
    );

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('product_model_matrix').delete().eq('id', matrixId);
      } catch (err) {
        console.warn('Supabase deleteMatrixItem error:', err);
      }
    }
  };

  // ==========================================
  // Inventory Adjustments (تسويات جردية)
  // ==========================================
  const addInventoryAdjustment = async (adj: {
    product_id: string;
    model_id?: string;
    adjustment_type: AdjustmentType;
    quantity_before: number;
    quantity_change: number;
    quantity_after: number;
    reason: string;
  }) => {
    const adjId = generateUUID();
    const product = products.find((p) => p.id === adj.product_id);
    const model = masterModels.find((m) => m.id === adj.model_id);

    const newAdjustment: InventoryAdjustment = {
      id: adjId,
      product_id: adj.product_id,
      product_title: product?.title_ar,
      product_sku: product?.sku,
      model_id: adj.model_id,
      model_name: model?.model_name,
      adjusted_by: staffSession?.id,
      adjuster_name: staffSession?.full_name || 'مدير المستودع',
      adjustment_type: adj.adjustment_type,
      quantity_before: adj.quantity_before,
      quantity_change: adj.quantity_change,
      quantity_after: adj.quantity_after,
      reason: adj.reason,
      created_at: new Date().toISOString(),
    };

    setInventoryAdjustments((prev) => [newAdjustment, ...prev]);

    // Update matrix or product stock
    if (adj.model_id && product?.matrix_items) {
      const item = product.matrix_items.find((m) => m.model_id === adj.model_id);
      if (item) {
        await updateMatrixItem(adj.product_id, item.id, adj.quantity_after, item.moq, calculateStockStatus(adj.quantity_after));
      }
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('inventory_adjustments').insert({
          id: adjId,
          product_id: adj.product_id,
          model_id: adj.model_id || null,
          adjusted_by: staffSession?.id || null,
          adjustment_type: adj.adjustment_type,
          quantity_before: adj.quantity_before,
          quantity_change: adj.quantity_change,
          quantity_after: adj.quantity_after,
          reason: adj.reason,
        });
      } catch (err) {
        console.warn('Supabase addInventoryAdjustment error:', err);
      }
    }
  };

  // ==========================================
  // Staff Auth & RBAC Security Guards
  // ==========================================
  const staffLogin = async (email: string, pass: string): Promise<{ success: boolean; message?: string; role?: UserRole }> => {
    const trimmed = email.trim().toLowerCase();

    if (!isSupabaseConfigured()) {
      return { success: false, message: 'لم يتم إعداد قاعدة البيانات. يرجى التواصل مع الدعم الفني.' };
    }

    try {
      const emailForAuth = trimmed.includes('@') ? trimmed : `${trimmed}@elmahdy.com`;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailForAuth,
        password: pass,
      });

      if (authError || !authData.user) {
        auditLog({
          action: 'staff_login_failed',
          metadata: { email: emailForAuth, reason: authError?.message || 'unknown' },
          severity: 'warn',
        });
        let msg = 'بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.';
        if (authError?.message?.includes('Email not confirmed')) {
          msg = 'البريد الإلكتروني لم يتم تأكيده في Supabase (فعّل خيار Auto Confirm User من لوحة التحكم).';
        } else if (authError?.message?.includes('Invalid login credentials')) {
          msg = 'كلمة المرور أو البريد الإلكتروني غير متطابقين.';
        } else if (authError?.message?.includes('Database error')) {
          msg = 'حدث خطأ في مزامنة حساب Supabase. يرجى إنشاء المستخدم من لوحة Supabase (Authentication -> Add user) مباشرة.';
        }
        return { success: false, message: msg };
      }

      // 1. Fetch profile linked to this auth user
      let { data: profile } = await supabase
        .from('user_profiles')
        .select('*, custom_role:custom_roles(*)')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle();

      // 2. If not linked yet, check by email to auto-link
      if (!profile) {
        const { data: emailProfile } = await supabase
          .from('user_profiles')
          .select('*, custom_role:custom_roles(*)')
          .eq('email', emailForAuth)
          .maybeSingle();

        if (emailProfile) {
          await supabase
            .from('user_profiles')
            .update({ auth_user_id: authData.user.id })
            .eq('id', emailProfile.id);
          profile = { ...emailProfile, auth_user_id: authData.user.id };
        } else if (emailForAuth === 'admin@elmahdy.com') {
          // Auto-provision default admin profile if missing
          const newAdminProfile: UserProfile = {
            id: '00000004-0000-0000-0000-000000000001',
            auth_user_id: authData.user.id,
            full_name: 'إدارة متجر MH المهدي',
            email: 'admin@elmahdy.com',
            phone: '01000000001',
            role: 'admin',
            is_active: true,
          };
          await supabase.from('user_profiles').upsert(newAdminProfile);
          profile = newAdminProfile;
        }
      }

      if (!profile) {
        await supabase.auth.signOut();
        return { success: false, message: 'لم يتم العثور على ملف الموظف المرتبط بهذا الحساب. يرجى التواصل مع المدير.' };
      }

      if (profile.role === 'customer') {
        await supabase.auth.signOut();
        return { success: false, message: 'هذا الحساب مخصص للعملاء فقط وليس له صلاحية دخول لوحة التحكم.' };
      }

      if (profile.is_active === false) {
        await supabase.auth.signOut();
        return { success: false, message: 'هذا الحساب معطل. يرجى التواصل مع المدير.' };
      }

      setStaffSession(profile);
      localStorage.setItem('mh_mahdy_staff', JSON.stringify(profile));
      auditLog({
        action: 'staff_login',
        actorId: profile.id,
        actorPhoneHint: phoneHint(profile.phone),
        metadata: { role: profile.role, email: profile.email },
        severity: 'info',
      });
      await refreshData();
      return { success: true, role: profile.role as UserRole };

    } catch (err) {
      console.error('staffLogin error:', err);
      return { success: false, message: 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.' };
    }
  };


  const staffLogout = () => {
    setStaffSession(null);
    try {
      localStorage.removeItem('mh_mahdy_staff');
    } catch {}
    if (isSupabaseConfigured()) {
      supabase.auth.signOut().catch(() => {});
    }
  };

  // ==========================================
  // Clear Filters
  // ==========================================
  const clearFilters = () => {
    setSelectedCategorySlug('all-products');
    setSearchQuery('');
    setSelectedBrand(null);
    setPriceRange([0, 7500]);
    setOnlyFeatured(false);
  };

  // ==========================================
  // Cart Actions
  // ==========================================
  const addToCart = (product: Product, model?: MasterModel, quantity?: number) => {
    const matrixItem = model && product.matrix_items
      ? product.matrix_items.find((m) => m.model_id === model.id)
      : undefined;

    const minQty = matrixItem ? matrixItem.moq : 1;
    const requestedQty = quantity !== undefined ? quantity : minQty;
    const addQty = enforceModelMOQ(requestedQty, minQty);

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.model?.id === model?.id
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += addQty;
        return updated;
      } else {
        return [
          ...prev,
          {
            product,
            model,
            quantity: addQty,
            unit_price: product.price,
            moq: minQty,
          },
        ];
      }
    });
  };

  const removeFromCart = (productId: string, modelId?: string) => {
    setCart((prev) =>
      prev.filter(
        (item) => !(item.product.id === productId && item.model?.id === modelId)
      )
    );
  };

  const updateCartQuantity = (productId: string, quantity: number, modelId?: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId && item.model?.id === modelId) {
          const finalQty = enforceModelMOQ(quantity, item.moq);
          return { ...item, quantity: finalQty };
        }
        return item;
      })
    );
  };

  const clearCart = () => setCart([]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
  }, [cart]);

  const cartItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Modals
  const openCompatibilityModal = (product: Product) => setCompatibilityProduct(product);
  const closeCompatibilityModal = () => setCompatibilityProduct(null);

  // Secure Customer Order Fetching (via sp_get_customer_orders RPC)
  const fetchCustomerOrders = async (customerId?: string, phone?: string) => {
    const targetId = customerId || currentUser?.id;
    const targetPhone = phone || currentUser?.phone;
    if (!isSupabaseConfigured() || !targetId || !targetPhone) return;

    try {
      const { data: custOrdersData, error: custErr } = await supabase.rpc('sp_get_customer_orders', {
        p_customer_id: targetId,
        p_phone: targetPhone,
      });

      if (!custErr && Array.isArray(custOrdersData)) {
        const assembledCustOrders: Order[] = custOrdersData.map((co: any) => ({
          id: co.id,
          order_number: co.order_number,
          customer_id: co.customer_id,
          customer_name: currentUser?.full_name || 'عميل تجاري',
          customer_phone: targetPhone,
          customer_company: currentUser?.company_name,
          sales_agent_id: co.sales_agent_id || undefined,
          status: co.status,
          total_amount: Number(co.total_amount),
          shipping_address: co.shipping_address,
          carrier_name: co.carrier_name,
          waybill_number: co.waybill_number,
          tracking_notes: co.tracking_notes,
          notes: co.notes,
          created_at: co.created_at,
          confirmed_at: co.confirmed_at,
          shipped_at: co.shipped_at,
          delivered_at: co.delivered_at,
          returned_at: co.returned_at,
          items: (co.items || []).map((it: any) => ({
            id: it.id,
            order_id: it.order_id,
            product_id: it.product_id,
            product_title: it.product_title || 'منتج',
            model_id: it.model_id || undefined,
            model_name: it.model_name,
            quantity: it.quantity,
            unit_price: Number(it.unit_price),
            subtotal: Number(it.subtotal),
          })),
        }));
        setOrders(assembledCustOrders);
      }
    } catch (err) {
      console.warn('fetchCustomerOrders error:', err);
    }
  };

  // Customer Auth — Separated Login (Secured via sp_customer_login RPC)
  const loginCustomer = async (phone: string): Promise<{ success: boolean; message?: string; user?: UserProfile }> => {
    const cleanPhone = normalizeEgyptianPhone(phone);
    if (!cleanPhone) return { success: false, message: 'يرجى إدخال رقم الهاتف' };

    if (isSupabaseConfigured()) {
      try {
        // Use secure RPC: prevents table enumeration while verifying credentials
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('sp_customer_login', {
          p_phone: cleanPhone,
        });

        if (!rpcErr && rpcRes) {
          if (!rpcRes.success) {
            auditLog({ action: 'customer_login_failed', actorPhoneHint: phoneHint(cleanPhone), severity: 'warn', errorMessage: rpcRes.message });
            return { success: false, message: rpcRes.message || 'رقم الهاتف غير مسجل، يرجى إنشاء حساب جديد' };
          }
          const u = rpcRes.user;
          const userProfile: UserProfile = {
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            phone: u.phone,
            company_name: u.company_name,
            role: 'customer',
            // First-Touch Stickiness: rep is null until a sales agent first processes this customer's order
            assigned_sales_rep_id: u.assigned_sales_rep_id || undefined,
            assigned_sales_rep_name: u.assigned_sales_rep_name || undefined,
            assigned_sales_rep_phone: u.assigned_sales_rep_phone || undefined,
          };
          setCurrentUser(userProfile);
          try { localStorage.setItem('mh_mahdy_user', JSON.stringify(userProfile)); } catch {}
          auditLog({ action: 'customer_login', actorId: userProfile.id, actorPhoneHint: phoneHint(userProfile.phone), severity: 'info' });
          // Securely load customer's order history via RPC
          fetchCustomerOrders(userProfile.id, userProfile.phone);
          return { success: true, user: userProfile };
        }

        // Direct select fallback if procedure not yet applied
        let existing: any = null;
        try {
          const { data } = await supabase
            .from('user_profiles')
            .select('*, assigned_sales_rep:user_profiles!assigned_sales_rep_id(id, full_name, phone)')
            .or(`phone.eq.${cleanPhone},phone.eq.${phone.trim()}`)
            .eq('role', 'customer')
            .maybeSingle();
          existing = data;
        } catch {
          const { data } = await supabase
            .from('user_profiles')
            .select('*')
            .or(`phone.eq.${cleanPhone},phone.eq.${phone.trim()}`)
            .eq('role', 'customer')
            .maybeSingle();
          existing = data;
        }

        if (!existing) {
          return { success: false, message: 'رقم الهاتف غير مسجل، يرجى إنشاء حساب جديد' };
        }

        const userProfile: UserProfile = {
          id: existing.id,
          email: existing.email,
          full_name: existing.full_name,
          phone: existing.phone,
          company_name: existing.company_name,
          role: 'customer',
          assigned_sales_rep_id: existing.assigned_sales_rep_id || undefined,
          assigned_sales_rep_name: existing.assigned_sales_rep?.full_name,
          assigned_sales_rep_phone: existing.assigned_sales_rep?.phone,
        };
        setCurrentUser(userProfile);
        try { localStorage.setItem('mh_mahdy_user', JSON.stringify(userProfile)); } catch {}
        fetchCustomerOrders(userProfile.id, userProfile.phone);
        return { success: true, user: userProfile };
      } catch (err) {
        console.warn('loginCustomer error:', err);
        return { success: false, message: 'حدث خطأ، يرجى المحاولة مرة أخرى' };
      }
    }

    return { success: false, message: 'لا يوجد اتصال بالخادم، يرجى المحاولة لاحقاً' };
  };

  // Customer Auth — Separated Register (Secured via sp_customer_register RPC)
  const registerCustomer = async (
    name: string,
    phone: string,
    company?: string,
    _address?: string,
    preferredSalesRepId?: string
  ): Promise<{ success: boolean; message?: string; user?: UserProfile }> => {
    const cleanName = name.trim();
    const cleanPhone = normalizeEgyptianPhone(phone);
    const cleanCompany = company?.trim() || undefined;

    if (!cleanName) return { success: false, message: 'يرجى إدخال الاسم الكامل' };
    if (!cleanPhone) return { success: false, message: 'يرجى إدخال رقم الهاتف' };
    if (!isValidEgyptianMobile(cleanPhone)) {
      return {
        success: false,
        message: 'يرجى إدخال رقم هاتف محمول مصري صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015',
      };
    }

    // Check if user selected a preferred sales rep from staff
    const chosenRep = preferredSalesRepId
      ? staffMembers.find((s) => s.id === preferredSalesRepId && s.is_active !== false)
      : null;

    // Auto least-loaded sales rep assignment fallback
    const leastRep = getLeastLoadedSalesRep();
    const targetRep = chosenRep || leastRep;
    const assignmentType = chosenRep ? 'customer_choice' : 'auto_fair_distribution';
    const assignmentNotes = chosenRep
      ? 'طلب العميل هذا المندوب مباشرة عند التسجيل'
      : 'توزيع تلقائي عادل (المندوب الأقل تشغيلاً)';

    if (isSupabaseConfigured()) {
      try {
        // Use atomic secure registration RPC with optional preferred sales rep
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('sp_customer_register', {
          p_name: cleanName,
          p_phone: cleanPhone,
          p_company: cleanCompany || null,
          p_sales_rep_id: chosenRep ? chosenRep.id : null,
        });

        if (!rpcErr && rpcRes) {
          if (!rpcRes.success) {
            return { success: false, message: rpcRes.message || 'فشل إنشاء الحساب' };
          }
          const u = rpcRes.user;
          const userProfile: UserProfile = {
            id: u.id,
            full_name: u.full_name,
            phone: u.phone,
            company_name: u.company_name,
            role: 'customer',
            assigned_sales_rep_id: u.assigned_sales_rep_id || targetRep?.id || undefined,
            assigned_sales_rep_name: u.assigned_sales_rep_name || targetRep?.full_name || undefined,
            assigned_sales_rep_phone: u.assigned_sales_rep_phone || targetRep?.phone || undefined,
            assignment_type: (u.assignment_type as AssignmentType) || assignmentType,
          };
          setCurrentUser(userProfile);
          try { localStorage.setItem('mh_mahdy_user', JSON.stringify(userProfile)); } catch {}

          // Update customers state and persistence
          setCustomers((prev) => [userProfile, ...prev.filter((c) => c.id !== userProfile.id)]);
          try {
            const stored = JSON.parse(localStorage.getItem('mh_mahdy_customers') || '[]');
            localStorage.setItem('mh_mahdy_customers', JSON.stringify([userProfile, ...stored.filter((c: any) => c.id !== userProfile.id)]));
          } catch {}

          // Record assignment in local assignments log
          const newAssignmentLog: SalesRepAssignment = {
            id: generateUUID(),
            customer_id: u.id,
            customer_name: cleanName,
            customer_phone: cleanPhone,
            customer_company: cleanCompany,
            sales_rep_id: targetRep?.id,
            sales_rep_name: targetRep?.full_name,
            assignment_type: assignmentType,
            notes: assignmentNotes,
            created_at: new Date().toISOString(),
          };
          setSalesRepAssignments((prev) => [newAssignmentLog, ...prev]);

          return { success: true, user: userProfile };
        }

        // Direct table upsert fallback
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('phone', cleanPhone)
          .eq('role', 'customer')
          .maybeSingle();

        if (existing) {
          return { success: false, message: 'هذا الرقم مسجل مسبقاً، يرجى تسجيل الدخول' };
        }

        const newId = generateUUID();
        const { data: created, error } = await supabase
          .from('user_profiles')
          .upsert({
            id: newId,
            full_name: cleanName,
            phone: cleanPhone,
            company_name: cleanCompany,
            role: 'customer',
            assigned_sales_rep_id: targetRep?.id || null,
          }, { onConflict: 'phone' })
          .select()
          .maybeSingle();

        if (error) throw error;

        // Log into sales_rep_assignments
        await supabase.from('sales_rep_assignments').insert({
          customer_id: newId,
          customer_name: cleanName,
          customer_phone: cleanPhone,
          customer_company: cleanCompany || null,
          sales_rep_id: targetRep?.id || null,
          sales_rep_name: targetRep?.full_name || null,
          assignment_type: assignmentType,
          notes: assignmentNotes,
        });

        const newAssignmentLog: SalesRepAssignment = {
          id: generateUUID(),
          customer_id: newId,
          customer_name: cleanName,
          customer_phone: cleanPhone,
          customer_company: cleanCompany,
          sales_rep_id: targetRep?.id,
          sales_rep_name: targetRep?.full_name,
          assignment_type: assignmentType,
          notes: assignmentNotes,
          created_at: new Date().toISOString(),
        };
        setSalesRepAssignments((prev) => [newAssignmentLog, ...prev]);

        const userProfile: UserProfile = {
          id: created?.id || newId,
          full_name: cleanName,
          phone: cleanPhone,
          company_name: cleanCompany,
          role: 'customer',
          assigned_sales_rep_id: targetRep?.id,
          assigned_sales_rep_name: targetRep?.full_name,
          assigned_sales_rep_phone: targetRep?.phone,
          assignment_type: assignmentType,
        };
        setCurrentUser(userProfile);
        try { localStorage.setItem('mh_mahdy_user', JSON.stringify(userProfile)); } catch {}

        setCustomers((prev) => [userProfile, ...prev.filter((c) => c.id !== userProfile.id)]);
        try {
          const stored = JSON.parse(localStorage.getItem('mh_mahdy_customers') || '[]');
          localStorage.setItem('mh_mahdy_customers', JSON.stringify([userProfile, ...stored.filter((c: any) => c.id !== userProfile.id)]));
        } catch {}

        return { success: true, user: userProfile };
      } catch (err) {
        console.warn('registerCustomer error:', err);
        return { success: false, message: 'حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة مرة أخرى' };
      }
    }

    // Offline fallback
    const userProfile: UserProfile = {
      id: generateUUID(),
      full_name: cleanName,
      phone: cleanPhone,
      company_name: cleanCompany,
      role: 'customer',
      assigned_sales_rep_id: targetRep?.id,
      assigned_sales_rep_name: targetRep?.full_name,
      assigned_sales_rep_phone: targetRep?.phone,
      assignment_type: assignmentType,
    };
    setCurrentUser(userProfile);
    try { localStorage.setItem('mh_mahdy_user', JSON.stringify(userProfile)); } catch {}

    setCustomers((prev) => [userProfile, ...prev.filter((c) => c.id !== userProfile.id)]);
    try {
      const stored = JSON.parse(localStorage.getItem('mh_mahdy_customers') || '[]');
      localStorage.setItem('mh_mahdy_customers', JSON.stringify([userProfile, ...stored.filter((c: any) => c.id !== userProfile.id)]));
    } catch {}

    const newAssignmentLog: SalesRepAssignment = {
      id: generateUUID(),
      customer_id: userProfile.id,
      customer_name: cleanName,
      customer_phone: cleanPhone,
      customer_company: cleanCompany,
      sales_rep_id: targetRep?.id,
      sales_rep_name: targetRep?.full_name,
      assignment_type: assignmentType,
      notes: assignmentNotes,
      created_at: new Date().toISOString(),
    };
    setSalesRepAssignments((prev) => [newAssignmentLog, ...prev]);

    return { success: true, user: userProfile };
  };

  const customerChangeSalesRep = async (
    preferredSalesRepId?: string,
    notes?: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) return { success: false, message: 'يرجى تسجيل الدخول أولاً' };

    const chosenRep = preferredSalesRepId
      ? staffMembers.find((s) => s.id === preferredSalesRepId && s.is_active !== false)
      : null;
    const leastRep = getLeastLoadedSalesRep();
    const targetRep = chosenRep || leastRep || DEFAULT_STICKY_SALES_REP;
    const assignmentType: AssignmentType = chosenRep ? 'customer_choice' : 'auto_fair_distribution';
    const finalNotes =
      notes ||
      (chosenRep
        ? 'قام العميل باختيار هذا المندوب بنفسه من حسابه'
        : 'طلب العميل إعادة التوزيع العادل التلقائي');

    const updatedUser: UserProfile = {
      ...currentUser,
      assigned_sales_rep_id: targetRep?.id,
      assigned_sales_rep_name: targetRep?.full_name,
      assigned_sales_rep_phone: targetRep?.phone,
      assignment_type: assignmentType,
    };
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('mh_mahdy_user', JSON.stringify(updatedUser));
    } catch {}

    setCustomers((prev) =>
      prev.map((c) => (c.id === currentUser.id ? { ...c, ...updatedUser } : c))
    );
    setOrders((prev) =>
      prev.map((o) =>
        o.customer_id === currentUser.id && o.status === 'pending'
          ? {
              ...o,
              sales_agent_id: targetRep?.id,
              sales_agent_name: targetRep?.full_name,
              sales_agent_phone: targetRep?.phone,
            }
          : o
      )
    );

    const newAssignmentLog: SalesRepAssignment = {
      id: generateUUID(),
      customer_id: currentUser.id,
      customer_name: currentUser.full_name,
      customer_phone: currentUser.phone,
      customer_company: currentUser.company_name,
      sales_rep_id: targetRep?.id,
      sales_rep_name: targetRep?.full_name,
      previous_rep_id: currentUser.assigned_sales_rep_id,
      previous_rep_name: currentUser.assigned_sales_rep_name,
      assignment_type: assignmentType,
      notes: finalNotes,
      created_at: new Date().toISOString(),
    };
    setSalesRepAssignments((prev) => [newAssignmentLog, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        await supabase.rpc('sp_customer_choose_sales_rep', {
          p_customer_id: currentUser.id,
          p_sales_rep_id: chosenRep ? chosenRep.id : null,
          p_notes: finalNotes,
        });
      } catch (e) {
        console.warn('sp_customer_choose_sales_rep error:', e);
      }
      await refreshData();
    }
    return { success: true, message: 'تم تحديث مندوبك المعتمد بنجاح' };
  };


  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('mh_mahdy_user');
      if (isSupabaseConfigured()) {
        supabase.auth.signOut().then(() => {});
      }
    } catch {}
  };

  // Place Order (Starts strictly as 'pending', inventory is NOT held yet)
  const placePendingOrder = async (shippingAddress: string, notes?: string): Promise<Order | null> => {
    if (!currentUser || cart.length === 0) return null;

    const orderId = generateUUID();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `ORD-${dateStr}-${seq}`;

    const newOrder: Order = {
      id: orderId,
      order_number: orderNumber,
      customer_id: currentUser.id,
      customer_name: currentUser.full_name,
      customer_phone: currentUser.phone,
      customer_company: currentUser.company_name,
      sales_agent_id: currentUser.assigned_sales_rep_id,
      sales_agent_name: currentUser.assigned_sales_rep_name,
      sales_agent_phone: currentUser.assigned_sales_rep_phone,
      status: 'pending',
      total_amount: cartTotal,
      shipping_address: shippingAddress,
      notes: notes,
      items: cart.map((ci) => ({
        id: generateUUID(),
        order_id: orderId,
        product_id: ci.product.id,
        product_title: ci.product.title_ar,
        product_sku: ci.product.sku,
        model_id: ci.model?.id,
        model_name: ci.model?.model_name,
        quantity: ci.quantity,
        unit_price: ci.unit_price,
        subtotal: ci.unit_price * ci.quantity,
      })),
      created_at: new Date().toISOString(),
    };

    setOrders((prev) => [newOrder, ...prev]);
    clearCart();

    if (isSupabaseConfigured()) {
      try {
        const itemsPayload = newOrder.items.map((it) => ({
          id: it.id,
          product_id: it.product_id,
          model_id: it.model_id || null,
          quantity: it.quantity,
          unit_price: it.unit_price,
          subtotal: it.subtotal,
        }));

        // Try atomic procedure first (bypasses RLS, handles customer profile creation)
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('sp_create_pending_order', {
          p_customer_name: currentUser.full_name,
          p_customer_phone: currentUser.phone,
          p_customer_company: currentUser.company_name || null,
          p_shipping_address: shippingAddress,
          p_notes: notes || null,
          p_total_amount: newOrder.total_amount,
          p_sales_agent_id: newOrder.sales_agent_id || null,
          p_items: itemsPayload,
        });

        if (!rpcErr && rpcRes && rpcRes.success) {
          if (rpcRes.order_id) newOrder.id = rpcRes.order_id;
          if (rpcRes.order_number) newOrder.order_number = rpcRes.order_number;
          if (rpcRes.customer_id) {
            newOrder.customer_id = rpcRes.customer_id;
            currentUser.id = rpcRes.customer_id;
            try { localStorage.setItem('mh_mahdy_user', JSON.stringify(currentUser)); } catch {}
          }
        } else {
          if (rpcErr) console.warn('sp_create_pending_order RPC failed, falling back to direct table insert:', rpcErr);

          // Direct table insert fallback: ensure profile exists first
          await supabase.from('user_profiles').upsert({
            id: currentUser.id,
            full_name: currentUser.full_name,
            phone: currentUser.phone,
            company_name: currentUser.company_name,
            role: 'customer',
            assigned_sales_rep_id: newOrder.sales_agent_id || null,
            is_active: true,
          }, { onConflict: 'phone' });

          const { error: oErr } = await supabase.from('orders').insert({
            id: orderId,
            order_number: orderNumber,
            customer_id: currentUser.id,
            sales_agent_id: newOrder.sales_agent_id || null,
            status: 'pending',
            total_amount: newOrder.total_amount,
            shipping_address: shippingAddress,
            notes: notes || null,
          });

          if (!oErr) {
            const directItems = newOrder.items.map((it) => ({
              id: it.id,
              order_id: orderId,
              product_id: it.product_id,
              model_id: it.model_id || null,
              quantity: it.quantity,
              unit_price: it.unit_price,
              subtotal: it.subtotal,
            }));
            await supabase.from('order_items').insert(directItems);
          } else {
            console.error('Supabase orders insert error:', oErr);
          }
        }
        fetchCustomerOrders(currentUser.id, currentUser.phone);
      } catch (err) {
        console.error('Supabase placePendingOrder error:', err);
      }
    }

    return newOrder;
  };

  // Self-service Order Cancellation for Customer (Pending Orders Only)
  const cancelCustomerOrder = async (orderId: string, reason?: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) return { success: false, message: 'يجب تسجيل الدخول أولاً' };

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.rpc('sp_cancel_pending_order', {
          p_order_id: orderId,
          p_customer_id: currentUser.id,
          p_phone: currentUser.phone,
          p_reason: reason || 'طلب إلغاء من العميل',
        });

        if (!error && data) {
          if (data.success) {
            const cancelledOrder = orders.find((o) => o.id === orderId);
            logOrderTransition({
              orderId,
              orderNumber: cancelledOrder?.order_number || orderId,
              fromStatus: cancelledOrder?.status || 'pending',
              toStatus: 'returned',
              actorId: currentUser.id,
              actorRole: 'customer',
            });
            await fetchCustomerOrders(currentUser.id, currentUser.phone);
            return { success: true, message: data.message || 'تم إلغاء الطلب بنجاح' };
          }
          return { success: false, message: data.message || 'تعذر إلغاء الطلب' };
        } else if (error) {
          console.warn('sp_cancel_pending_order error, executing direct update fallback:', error.message);
          const { error: directErr } = await supabase
            .from('orders')
            .update({
              status: 'returned',
              return_reason: 'other',
              return_notes: reason || 'طلب إلغاء من العميل',
              returned_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .eq('customer_id', currentUser.id)
            .eq('status', 'pending');

          if (!directErr) {
            const cancelledOrder = orders.find((o) => o.id === orderId);
            logOrderTransition({
              orderId,
              orderNumber: cancelledOrder?.order_number || orderId,
              fromStatus: cancelledOrder?.status || 'pending',
              toStatus: 'returned',
              actorId: currentUser.id,
              actorRole: 'customer',
            });
            await fetchCustomerOrders(currentUser.id, currentUser.phone);
            return { success: true, message: 'تم إلغاء الطلب بنجاح' };
          }
        }
      } catch (err) {
        console.warn('cancelCustomerOrder error:', err);
      }
    }

    // Local state fallback
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId && o.status === 'pending' ? { ...o, status: 'returned' } : o))
    );
    return { success: true, message: 'تم إلغاء الطلب بنجاح' };
  };

  // Update Order Status (Pending -> Preparation [Deducts stock] -> Shipping -> Delivered / Returned)
  const updateOrderStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    trackingNotes?: string,
    carrierName?: string,
    waybillNumber?: string,
    returnReason?: ReturnReason,
    returnNotes?: string
  ) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;

        // Inventory Hold: Deduct stock when moving from pending to preparation
        if (order.status === 'pending' && newStatus === 'preparation') {
          setProducts((currentProducts) =>
            currentProducts.map((p) => {
              const orderItemsForProduct = order.items.filter((item) => item.product_id === p.id);
              if (orderItemsForProduct.length === 0 || !p.matrix_items) return p;

              const updatedMatrix = deductStockForOrder(p.matrix_items, orderItemsForProduct);
              return { ...p, matrix_items: updatedMatrix };
            })
          );
        }

        const nowIso = new Date().toISOString();
        return {
          ...order,
          status: newStatus,
          carrier_name: carrierName || order.carrier_name,
          waybill_number: waybillNumber || order.waybill_number,
          tracking_notes: trackingNotes || order.tracking_notes,
          return_reason: returnReason || order.return_reason,
          return_notes: returnNotes || order.return_notes,
          confirmed_at: newStatus === 'preparation' ? (order.confirmed_at || nowIso) : order.confirmed_at,
          shipped_at: newStatus === 'shipping' ? (order.shipped_at || nowIso) : order.shipped_at,
          delivered_at: newStatus === 'delivered' ? (order.delivered_at || nowIso) : order.delivered_at,
          returned_at: newStatus === 'returned' ? (order.returned_at || nowIso) : order.returned_at,
        };
      })
    );

    if (isSupabaseConfigured()) {
      try {
        const nowIso = new Date().toISOString();
        const updatePayload: Record<string, unknown> = {
          status: newStatus,
          updated_at: nowIso,
        };
        if (trackingNotes !== undefined) updatePayload.tracking_notes = trackingNotes;
        if (carrierName !== undefined) updatePayload.carrier_name = carrierName;
        if (waybillNumber !== undefined) updatePayload.waybill_number = waybillNumber;
        if (returnReason !== undefined) updatePayload.return_reason = returnReason;
        if (returnNotes !== undefined) updatePayload.return_notes = returnNotes;
        if (newStatus === 'preparation') updatePayload.confirmed_at = nowIso;
        if (newStatus === 'shipping') updatePayload.shipped_at = nowIso;
        if (newStatus === 'delivered') updatePayload.delivered_at = nowIso;
        if (newStatus === 'returned') updatePayload.returned_at = nowIso;

        // Auto-assign sticky sales rep if order or customer is unassigned and current user is a sales agent
        const currentOrder = orders.find((o) => o.id === orderId);
        if (currentOrder && staffSession && staffSession.role === 'sales_agent') {
          if (!currentOrder.sales_agent_id) {
            updatePayload.sales_agent_id = staffSession.id;
          }
          if (currentOrder.customer_id) {
            try {
              await supabase.rpc('sp_assign_sticky_sales_rep', {
                p_customer_id: currentOrder.customer_id,
                p_sales_agent_id: staffSession.id,
              });
            } catch (e) {
              console.warn('sp_assign_sticky_sales_rep rpc notice:', e);
            }
          }
        }

        await supabase.from('orders').update(updatePayload).eq('id', orderId);

        // Audit log the status transition
        if (currentOrder && currentOrder.status !== newStatus) {
          logOrderTransition({
            orderId,
            orderNumber: currentOrder.order_number,
            fromStatus: currentOrder.status,
            toStatus: newStatus,
            actorId: staffSession?.id || currentUser?.id,
            actorRole: staffSession?.role || currentUser?.role || 'unknown',
          });
        }

        await refreshData();
      } catch (err) {
        console.warn('Supabase updateOrderStatus error:', err);
      }
    }
  };

  // Reassign / Assign Sticky Sales Rep directly (CRM — Admin only action, with Data Log recording)
  const assignCustomerSalesRep = async (
    customerId: string,
    salesRepId: string,
    notes?: string,
    reassignPendingOrders: boolean = true
  ): Promise<{ success: boolean; message?: string }> => {
    const customer = customers.find((c) => c.id === customerId);
    const oldRep = staffMembers.find((s) => s.id === customer?.assigned_sales_rep_id);
    const newRep = staffMembers.find((s) => s.id === salesRepId);

    // Update customer in local state
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId
          ? {
              ...c,
              assigned_sales_rep_id: salesRepId,
              assigned_sales_rep_name: newRep?.full_name,
              assigned_sales_rep_phone: newRep?.phone,
              assignment_type: 'admin_transfer',
            }
          : c
      )
    );

    // Update pending orders for this customer in local state
    if (reassignPendingOrders) {
      setOrders((prev) =>
        prev.map((o) =>
          o.customer_id === customerId && o.status === 'pending'
            ? {
                ...o,
                sales_agent_id: salesRepId,
                sales_agent_name: newRep?.full_name,
                sales_agent_phone: newRep?.phone,
              }
            : o
        )
      );
    }

    // Add assignment record to local data log
    const newAssignmentLog: SalesRepAssignment = {
      id: generateUUID(),
      customer_id: customerId,
      customer_name: customer?.full_name || 'عميل',
      customer_phone: customer?.phone || '',
      customer_company: customer?.company_name,
      sales_rep_id: salesRepId,
      sales_rep_name: newRep?.full_name,
      previous_rep_id: oldRep?.id,
      previous_rep_name: oldRep?.full_name,
      assignment_type: 'admin_transfer',
      notes: notes || 'تحويل إداري من لوحة التحكم',
      assigned_by: staffSession?.id,
      assigned_by_name: staffSession?.full_name,
      created_at: new Date().toISOString(),
    };
    setSalesRepAssignments((prev) => [newAssignmentLog, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('sp_admin_transfer_customer_rep', {
          p_customer_id: customerId,
          p_new_rep_id: salesRepId,
          p_notes: notes || null,
          p_admin_id: staffSession?.id || null,
          p_reassign_pending_orders: reassignPendingOrders,
        });

        if (rpcErr) {
          console.warn('sp_admin_transfer_customer_rep failed, falling back to direct updates:', rpcErr);
          await supabase
            .from('user_profiles')
            .update({ assigned_sales_rep_id: salesRepId, updated_at: new Date().toISOString() })
            .eq('id', customerId);

          if (reassignPendingOrders) {
            await supabase
              .from('orders')
              .update({ sales_agent_id: salesRepId })
              .eq('customer_id', customerId)
              .eq('status', 'pending');
          }

          await supabase.from('sales_rep_assignments').insert({
            customer_id: customerId,
            customer_name: customer?.full_name || 'عميل',
            customer_phone: customer?.phone || '',
            customer_company: customer?.company_name || null,
            sales_rep_id: salesRepId,
            sales_rep_name: newRep?.full_name || null,
            previous_rep_id: oldRep?.id || null,
            previous_rep_name: oldRep?.full_name || null,
            assignment_type: 'admin_transfer',
            notes: notes || 'تحويل إداري من لوحة التحكم',
            assigned_by: staffSession?.id || null,
            assigned_by_name: staffSession?.full_name || null,
          });
        }
      } catch (err) {
        console.warn('assignCustomerSalesRep error:', err);
      }
      await refreshData();
    }

    return { success: true, message: 'تم تحويل العميل بنجاح وتوثيق الحركة في سجل العمليات' };
  };

  // Admin: Create New Customer Manually
  const adminCreateCustomer = async (data: {
    full_name: string;
    phone: string;
    company_name?: string;
    sales_rep_id?: string;
    notes?: string;
  }): Promise<{ success: boolean; message?: string; customer?: UserProfile }> => {
    const cleanName = data.full_name.trim();
    const cleanPhone = normalizeEgyptianPhone(data.phone);
    if (!cleanName) return { success: false, message: 'يرجى إدخال اسم العميل' };
    if (!cleanPhone || !isValidEgyptianMobile(cleanPhone)) {
      return { success: false, message: 'يرجى إدخال رقم هاتف محمول مصري صحيح' };
    }

    if (customers.some((c) => c.phone === cleanPhone)) {
      return { success: false, message: 'رقم الهاتف مسجل مسبقاً لعميل آخر' };
    }

    const chosenRep = data.sales_rep_id
      ? staffMembers.find((s) => s.id === data.sales_rep_id && s.is_active !== false)
      : null;
    const leastRep = getLeastLoadedSalesRep();
    const targetRep = chosenRep || leastRep || DEFAULT_STICKY_SALES_REP;
    const assignmentType: AssignmentType = chosenRep ? 'admin_transfer' : 'auto_fair_distribution';

    const newCustId = generateUUID();
    const newCustomer: UserProfile = {
      id: newCustId,
      full_name: cleanName,
      phone: cleanPhone,
      company_name: data.company_name?.trim() || undefined,
      role: 'customer',
      is_active: true,
      assigned_sales_rep_id: targetRep?.id,
      assigned_sales_rep_name: targetRep?.full_name,
      assigned_sales_rep_phone: targetRep?.phone,
      assignment_type: assignmentType,
      created_at: new Date().toISOString(),
    };

    setCustomers((prev) => [newCustomer, ...prev]);
    try {
      const stored = JSON.parse(localStorage.getItem('mh_mahdy_customers') || '[]');
      localStorage.setItem('mh_mahdy_customers', JSON.stringify([newCustomer, ...stored]));
    } catch {}

    const newAssignmentLog: SalesRepAssignment = {
      id: generateUUID(),
      customer_id: newCustId,
      customer_name: cleanName,
      customer_phone: cleanPhone,
      customer_company: data.company_name,
      sales_rep_id: targetRep?.id,
      sales_rep_name: targetRep?.full_name,
      assignment_type: assignmentType,
      notes: data.notes || 'تمت إضافة العميل من لوحة التحكم',
      assigned_by: staffSession?.id,
      assigned_by_name: staffSession?.full_name,
      created_at: new Date().toISOString(),
    };
    setSalesRepAssignments((prev) => [newAssignmentLog, ...prev]);

    if (isSupabaseConfigured()) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('sp_admin_save_customer', {
          p_id: null,
          p_full_name: cleanName,
          p_phone: cleanPhone,
          p_company_name: data.company_name?.trim() || null,
          p_is_active: true,
          p_assigned_sales_rep_id: targetRep?.id || null,
          p_notes: data.notes || null,
          p_admin_id: staffSession?.id || null,
        });

        if (rpcErr || (rpcRes && !rpcRes.success)) {
          console.warn('sp_admin_save_customer notice:', rpcErr || rpcRes?.message);
        }
      } catch (err) {
        console.warn('adminCreateCustomer RPC error:', err);
      }
      await refreshData();
    }

    return { success: true, message: 'تم إنشاء حساب العميل وربطه بالمندوب بنجاح', customer: newCustomer };
  };

  // Admin: Update Customer Details
  const adminUpdateCustomer = async (
    id: string,
    updates: {
      full_name?: string;
      phone?: string;
      company_name?: string;
      sales_rep_id?: string;
      is_active?: boolean;
      notes?: string;
    }
  ): Promise<{ success: boolean; message?: string }> => {
    const existingCust = customers.find((c) => c.id === id);
    if (!existingCust) return { success: false, message: 'العميل غير موجود' };

    const cleanName = updates.full_name !== undefined ? updates.full_name.trim() : existingCust.full_name;
    const cleanPhone = updates.phone !== undefined ? normalizeEgyptianPhone(updates.phone) : existingCust.phone;
    const cleanCompany = updates.company_name !== undefined ? updates.company_name.trim() : existingCust.company_name;
    const isActive = updates.is_active !== undefined ? updates.is_active : (existingCust.is_active !== false);

    let targetRep = updates.sales_rep_id
      ? staffMembers.find((s) => s.id === updates.sales_rep_id && s.is_active !== false)
      : null;
    const repChanged = updates.sales_rep_id && updates.sales_rep_id !== existingCust.assigned_sales_rep_id;

    const updatedCust: UserProfile = {
      ...existingCust,
      full_name: cleanName,
      phone: cleanPhone,
      company_name: cleanCompany,
      is_active: isActive,
      assigned_sales_rep_id: targetRep ? targetRep.id : existingCust.assigned_sales_rep_id,
      assigned_sales_rep_name: targetRep ? targetRep.full_name : existingCust.assigned_sales_rep_name,
      assigned_sales_rep_phone: targetRep ? targetRep.phone : existingCust.assigned_sales_rep_phone,
      assignment_type: repChanged ? 'admin_transfer' : existingCust.assignment_type,
    };

    setCustomers((prev) => prev.map((c) => (c.id === id ? updatedCust : c)));
    try {
      localStorage.setItem('mh_mahdy_customers', JSON.stringify(customers.map((c) => (c.id === id ? updatedCust : c))));
    } catch {}

    if (repChanged && targetRep) {
      setOrders((prev) =>
        prev.map((o) =>
          o.customer_id === id && o.status === 'pending'
            ? {
                ...o,
                sales_agent_id: targetRep!.id,
                sales_agent_name: targetRep!.full_name,
                sales_agent_phone: targetRep!.phone,
              }
            : o
        )
      );

      const logEntry: SalesRepAssignment = {
        id: generateUUID(),
        customer_id: id,
        customer_name: cleanName,
        customer_phone: cleanPhone,
        customer_company: cleanCompany,
        sales_rep_id: targetRep.id,
        sales_rep_name: targetRep.full_name,
        previous_rep_id: existingCust.assigned_sales_rep_id,
        previous_rep_name: existingCust.assigned_sales_rep_name,
        assignment_type: 'admin_transfer',
        notes: updates.notes || 'تعديل بيانات العميل والمندوب من الإدارة',
        assigned_by: staffSession?.id,
        assigned_by_name: staffSession?.full_name,
        created_at: new Date().toISOString(),
      };
      setSalesRepAssignments((prev) => [logEntry, ...prev]);
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.rpc('sp_admin_save_customer', {
          p_id: id,
          p_full_name: cleanName,
          p_phone: cleanPhone,
          p_company_name: cleanCompany || null,
          p_is_active: isActive,
          p_assigned_sales_rep_id: targetRep ? targetRep.id : existingCust.assigned_sales_rep_id || null,
          p_notes: updates.notes || null,
          p_admin_id: staffSession?.id || null,
        });
      } catch (err) {
        console.warn('adminUpdateCustomer RPC error:', err);
      }
      await refreshData();
    }

    return { success: true, message: 'تم تحديث بيانات العميل بنجاح' };
  };

  // Admin: Toggle Customer Active Status
  const adminToggleCustomerActive = async (id: string, isActive: boolean): Promise<{ success: boolean; message?: string }> => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: isActive } : c))
    );
    try {
      const stored = JSON.parse(localStorage.getItem('mh_mahdy_customers') || '[]');
      localStorage.setItem(
        'mh_mahdy_customers',
        JSON.stringify(stored.map((c: any) => (c.id === id ? { ...c, is_active: isActive } : c)))
      );
    } catch {}

    if (isSupabaseConfigured()) {
      try {
        await supabase.rpc('sp_admin_toggle_customer_status', {
          p_customer_id: id,
          p_is_active: isActive,
        });
      } catch (err) {
        console.warn('adminToggleCustomerActive error:', err);
        await supabase.from('user_profiles').update({ is_active: isActive }).eq('id', id);
      }
      await refreshData();
    }

    return {
      success: true,
      message: isActive ? 'تم تفعيل حساب العميل بنجاح' : 'تم تعطيل حساب العميل بنجاح',
    };
  };

  // Admin: Delete Customer
  const adminDeleteCustomer = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const hasOrders = orders.some((o) => o.customer_id === id && o.status !== 'returned');
    if (hasOrders) {
      return adminToggleCustomerActive(id, false);
    }

    setCustomers((prev) => prev.filter((c) => c.id !== id));
    try {
      const stored = JSON.parse(localStorage.getItem('mh_mahdy_customers') || '[]');
      localStorage.setItem('mh_mahdy_customers', JSON.stringify(stored.filter((c: any) => c.id !== id)));
    } catch {}

    if (isSupabaseConfigured()) {
      try {
        const { data: rpcRes } = await supabase.rpc('sp_admin_delete_customer', {
          p_customer_id: id,
        });
        if (rpcRes?.message) {
          await refreshData();
          return { success: true, message: rpcRes.message };
        }
      } catch (err) {
        console.warn('adminDeleteCustomer error:', err);
        await supabase.from('user_profiles').delete().eq('id', id);
      }
      await refreshData();
    }

    return { success: true, message: 'تم حذف العميل وسجلاته بنجاح' };
  };

  // Automatic Least-Loaded Sales Rep (Equal Opportunities Distribution)
  const getLeastLoadedSalesRep = useCallback((): UserProfile | null => {
    const eligibleReps = staffMembers.filter((s) => {
      if (s.is_active === false) return false;
      if (s.role === 'sales_agent') return true;
      if (s.custom_role?.can_receive_customers) return true;
      const cRole = customRoles.find((r) => r.id === s.custom_role_id);
      if (cRole?.can_receive_customers) return true;
      return false;
    });

    if (eligibleReps.length === 0) {
      const adminRep = staffMembers.find((s) => s.role === 'admin' && s.is_active !== false);
      return adminRep || DEFAULT_STICKY_SALES_REP;
    }

    const countMap: Record<string, number> = {};
    eligibleReps.forEach((r) => { countMap[r.id] = 0; });

    customers.forEach((c) => {
      if (c.assigned_sales_rep_id && countMap[c.assigned_sales_rep_id] !== undefined) {
        countMap[c.assigned_sales_rep_id]++;
      }
    });

    let minRep = eligibleReps[0];
    let minCount = countMap[minRep.id] ?? 0;

    for (let i = 1; i < eligibleReps.length; i++) {
      const rep = eligibleReps[i];
      const count = countMap[rep.id] ?? 0;
      if (count < minCount) {
        minCount = count;
        minRep = rep;
      }
    }

    return minRep;
  }, [staffMembers, customers, customRoles]);

  // Aggregate Comprehensive Performance Reports for all sales reps
  const getSalesRepPerformanceReports = useCallback((): SalesRepPerformanceReport[] => {
    const eligibleReps = staffMembers.filter((s) => {
      if (s.is_active === false) return false;
      if (s.role === 'sales_agent') return true;
      if (s.custom_role?.can_receive_customers) return true;
      const cRole = customRoles.find((r) => r.id === s.custom_role_id);
      if (cRole?.can_receive_customers) return true;
      return s.role === 'admin';
    });

    const totalAssignedCustomersAll = customers.filter((c) => c.assigned_sales_rep_id).length || 1;

    return eligibleReps.map((rep) => {
      const repCustomers = customers.filter((c) => c.assigned_sales_rep_id === rep.id);
      const totalCustCount = repCustomers.length;

      const repAssignments = salesRepAssignments.filter((a) => a.sales_rep_id === rep.id);
      const customerChoiceCount = repAssignments.filter((a) => a.assignment_type === 'customer_choice').length;
      const autoDistributedCount = repAssignments.filter((a) => a.assignment_type === 'auto_fair_distribution').length;
      const transferredInCount = repAssignments.filter((a) => a.assignment_type === 'admin_transfer').length;
      const transferredOutCount = salesRepAssignments.filter(
        (a) => a.previous_rep_id === rep.id && a.assignment_type === 'admin_transfer'
      ).length;

      const repOrders = orders.filter((o) => o.sales_agent_id === rep.id);
      const totalOrders = repOrders.length;
      const pendingOrders = repOrders.filter((o) => o.status === 'pending').length;
      const deliveredOrders = repOrders.filter((o) => o.status === 'delivered').length;
      const returnedOrders = repOrders.filter((o) => o.status === 'returned').length;
      const totalRevenue = repOrders
        .filter((o) => o.status !== 'returned')
        .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const conversionRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;
      const loadSharePercentage = (totalCustCount / totalAssignedCustomersAll) * 100;

      return {
        repId: rep.id,
        repName: rep.full_name,
        repPhone: rep.phone,
        role: rep.role,
        isActive: rep.is_active !== false,
        totalCustomers: totalCustCount,
        customerChoiceCount,
        autoDistributedCount,
        transferredInCount,
        transferredOutCount,
        totalOrders,
        pendingOrders,
        deliveredOrders,
        returnedOrders,
        totalRevenue,
        averageOrderValue,
        conversionRate,
        loadSharePercentage,
      };
    });
  }, [staffMembers, customRoles, customers, salesRepAssignments, orders]);

  // Custom Roles & Permissions Management (Admin)
  const addCustomRole = async (newRole: Omit<CustomRole, 'id' | 'created_at' | 'updated_at'>) => {
    const roleId = generateUUID();
    const roleObj: CustomRole = {
      ...newRole,
      id: roleId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setCustomRoles((prev) => [...prev, roleObj]);
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('custom_roles').insert({
          id: roleId,
          ...newRole,
        });
        if (error) throw error;
      } catch (err: any) {
        console.warn('addCustomRole error:', err);
        return { success: false, message: err.message || 'فشل حفظ الدور' };
      }
      await refreshData();
    }
    return { success: true };
  };

  const updateCustomRole = async (id: string, updates: Partial<CustomRole>) => {
    setCustomRoles((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates, updated_at: new Date().toISOString() } : r))
    );
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('custom_roles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
      } catch (err: any) {
        console.warn('updateCustomRole error:', err);
        return { success: false, message: err.message || 'فشل تعديل الدور' };
      }
      await refreshData();
    }
    return { success: true };
  };

  const deleteCustomRole = async (id: string) => {
    const existing = customRoles.find((r) => r.id === id);
    if (existing?.is_system) {
      return { success: false, message: 'لا يمكن حذف الأدوار الأساسية للنظام' };
    }
    const assignedStaff = staffMembers.filter((s) => s.custom_role_id === id);
    if (assignedStaff.length > 0) {
      return { success: false, message: `لا يمكن حذف هذا الدور لوجود ${assignedStaff.length} موظف مرتبطين به حالياً` };
    }
    setCustomRoles((prev) => prev.filter((r) => r.id !== id));
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('custom_roles').delete().eq('id', id);
        if (error) throw error;
      } catch (err: any) {
        console.warn('deleteCustomRole error:', err);
        return { success: false, message: err.message || 'فشل حذف الدور' };
      }
      await refreshData();
    }
    return { success: true };
  };

  // Shortages System (Internal Admin Alert — No customer reward/discount)
  const submitShortage = async (brand: string, modelName: string, notes?: string) => {
    const shortageId = generateUUID();
    const newShortage: ShortageRequest = {
      id: shortageId,
      customer_id: currentUser ? currentUser.id : '00000006-0000-0000-0000-000000000001',
      customer_name: currentUser ? currentUser.full_name : 'عميل تجاري زائر',
      customer_phone: currentUser ? currentUser.phone : 'غير محدد',
      brand,
      model_name: modelName,
      notes,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    setShortages((prev) => [newShortage, ...prev]);
    setIsShortageModalOpen(false);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('shortage_requests').insert({
          id: shortageId,
          customer_id: currentUser ? currentUser.id : null,
          customer_name: newShortage.customer_name,
          customer_phone: newShortage.customer_phone,
          brand: brand,
          model_name: modelName,
          notes: notes || null,
          status: 'pending',
        });
      } catch (err) {
        console.warn('Supabase submitShortage error:', err);
      }
    }
  };

  const updateShortageStatus = async (id: string, status: 'pending' | 'reviewed') => {
    setShortages((prev) =>
      prev.map((sh) => (sh.id === id ? { ...sh, status } : sh))
    );

    if (isSupabaseConfigured()) {
      try {
        await supabase
          .from('shortage_requests')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase updateShortageStatus error:', err);
      }
    }
  };

  // Compare & Wishlist
  const toggleCompare = (product: Product) => {
    setCompareList((prev) => {
      if (prev.some((p) => p.id === product.id)) {
        return prev.filter((p) => p.id !== product.id);
      }
      if (prev.length >= 4) {
        alert('يمكنك مقارنة 4 منتجات كحد أقصى');
        return prev;
      }
      return [...prev, product];
    });
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      try {
        localStorage.setItem('mh_mahdy_wishlist', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearWishlist = () => {
    setWishlist([]);
    try {
      localStorage.removeItem('mh_mahdy_wishlist');
    } catch {}
  };

  return (
    <StoreContext.Provider
      value={{
        isLoading,
        refreshData,

        categories,
        categoriesTree,
        addCategory,
        updateCategory,
        deleteCategory,
        selectedCategorySlug,
        setSelectedCategorySlug,

        products,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductActive,

        masterModels,
        addMasterModel,
        deleteMasterModel,
        addModelToMatrix,
        bulkAddModelsToMatrix,
        copyProductMatrix,
        updateMatrixItem,
        deleteMatrixItem,

        inventoryAdjustments,
        addInventoryAdjustment,

        searchQuery,
        setSearchQuery,
        selectedBrand,
        setSelectedBrand,
        priceRange,
        setPriceRange,
        onlyFeatured,
        setOnlyFeatured,
        clearFilters,

        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartTotal,
        cartItemsCount,
        isCartOpen,
        setIsCartOpen,

        compatibilityProduct,
        openCompatibilityModal,
        closeCompatibilityModal,
        isShortageModalOpen,
        setIsShortageModalOpen,
        isAccountModalOpen,
        setIsAccountModalOpen,
        accountModalTab,
        setAccountModalTab,
        openAccountModalWithTab,

        currentUser,
        setCurrentUser,
        loginCustomer,
        registerCustomer,
        fetchCustomerOrders,
        logout,
        assignedSalesAgent,
        customers,
        staffMembers,
        salesRepAssignments,
        assignCustomerSalesRep,
        customerChangeSalesRep,
        getLeastLoadedSalesRep,
        getSalesRepPerformanceReports,
        adminCreateCustomer,
        adminUpdateCustomer,
        adminToggleCustomerActive,
        adminDeleteCustomer,

        customRoles,
        addCustomRole,
        updateCustomRole,
        deleteCustomRole,

        staffSession,
        staffLogin,
        staffLogout,

        orders,
        placePendingOrder,
        cancelCustomerOrder,
        updateOrderStatus,

        shortages,
        submitShortage,
        updateShortageStatus,

        compareList,
        toggleCompare,
        wishlist,
        toggleWishlist,
        isWishlistOpen,
        setIsWishlistOpen,
        clearWishlist,

        storeSettings,
        updateStoreSettings,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
