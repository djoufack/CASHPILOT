import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks – hooks
// ---------------------------------------------------------------------------

const mockFetchAlerts = vi.fn();
const mockResolveAlert = vi.fn();
const mockGetProductHistory = vi.fn().mockResolvedValue([]);
const mockAddHistoryEntry = vi.fn().mockResolvedValue(true);
const mockGetStockValuationContext = vi.fn().mockResolvedValue({
  historyEntries: [],
  supplierOrderItems: [],
});
const mockCreateProduct = vi.fn();
const mockUpdateProduct = vi.fn();
const mockDeleteProduct = vi.fn();
const mockFetchProducts = vi.fn();
const mockCreateWarehouse = vi.fn();
const mockUpdateWarehouse = vi.fn();
const mockCreateLot = vi.fn();

vi.mock('@/hooks/useStockHistory', () => ({
  useStockAlerts: () => ({
    alerts: [
      {
        id: 'alert-1',
        type: 'low_stock',
        message: 'Low stock for Widget A',
        product: { id: 'prod-1', product_name: 'Widget A', inventory_tracking_enabled: true },
      },
    ],
    fetchAlerts: mockFetchAlerts,
    resolveAlert: mockResolveAlert,
  }),
  useStockHistory: () => ({
    getProductHistory: mockGetProductHistory,
    addHistoryEntry: mockAddHistoryEntry,
    getStockValuationContext: mockGetStockValuationContext,
    loading: false,
  }),
}));

vi.mock('@/hooks/useProducts', () => ({
  useProducts: () => ({
    products: [
      {
        id: 'prod-1',
        product_name: 'Widget A',
        sku: 'WID-001',
        category_id: 'cat-1',
        supplier_id: 'sup-1',
        unit_price: 25.0,
        purchase_price: 10.0,
        stock_quantity: 3,
        min_stock_level: 5,
        unit: 'piece',
        description: 'A small widget',
        inventory_tracking_enabled: true,
        category: { id: 'cat-1', name: 'Widgets' },
        supplier: { id: 'sup-1', company_name: 'WidgetCo' },
      },
      {
        id: 'prod-2',
        product_name: 'Gadget B',
        sku: 'GAD-002',
        category_id: 'cat-2',
        supplier_id: 'sup-2',
        unit_price: 100.0,
        purchase_price: 60.0,
        stock_quantity: 50,
        min_stock_level: 10,
        unit: 'piece',
        description: 'A premium gadget',
        inventory_tracking_enabled: true,
        category: { id: 'cat-2', name: 'Gadgets' },
        supplier: { id: 'sup-2', company_name: 'GadgetInc' },
      },
      {
        id: 'prod-3',
        product_name: 'Service X',
        sku: 'SVC-003',
        unit_price: 200.0,
        purchase_price: 0,
        stock_quantity: 0,
        min_stock_level: 0,
        unit: 'hour',
        inventory_tracking_enabled: false,
      },
    ],
    loading: false,
    createProduct: mockCreateProduct,
    updateProduct: mockUpdateProduct,
    deleteProduct: mockDeleteProduct,
    fetchProducts: mockFetchProducts,
  }),
  useProductCategories: () => ({
    categories: [
      { id: 'cat-1', name: 'Widgets' },
      { id: 'cat-2', name: 'Gadgets' },
    ],
  }),
}));

vi.mock('@/hooks/useSuppliers', () => ({
  useSuppliers: () => ({
    suppliers: [
      { id: 'sup-1', company_name: 'WidgetCo' },
      { id: 'sup-2', company_name: 'GadgetInc' },
    ],
  }),
}));

vi.mock('@/hooks/useInventoryWarehouses', () => ({
  useInventoryWarehouses: () => ({
    warehouses: [
      {
        id: 'wh-1',
        warehouse_code: 'MAIN',
        warehouse_name: 'Entrepot principal',
        description: 'Site central',
        is_default: true,
        is_active: true,
      },
    ],
    loading: false,
    createWarehouse: mockCreateWarehouse,
    updateWarehouse: mockUpdateWarehouse,
  }),
  useInventoryLots: () => ({
    lots: [
      {
        id: 'lot-1',
        lot_number: 'LOT-001',
        serial_number: 'SN-001',
        quantity: 3,
        status: 'active',
        received_at: '2026-03-01',
        expiry_date: null,
        product: { id: 'prod-1', product_name: 'Widget A', sku: 'WID-001' },
        warehouse: { id: 'wh-1', warehouse_code: 'MAIN', warehouse_name: 'Entrepot principal' },
      },
    ],
    loading: false,
    createLot: mockCreateLot,
  }),
}));

vi.mock('@/hooks/useCompany', () => ({
  useCompany: () => ({
    company: {
      id: 'company-1',
      company_name: 'Test Company',
      accounting_currency: 'EUR',
    },
  }),
}));

vi.mock('@/hooks/useCreditsGuard', () => ({
  useCreditsGuard: () => ({
    guardedAction: (_cost, _label, action) => action(),
    modalProps: { open: false, onClose: vi.fn() },
  }),
  CREDIT_COSTS: {
    PDF_REPORT: 1,
    EXPORT_HTML: 1,
  },
}));

vi.mock('@/hooks/usePagination', () => ({
  usePagination: () => ({
    from: 0,
    to: 24,
    page: 1,
    pageSize: 25,
    totalCount: 3,
    setTotalCount: vi.fn(),
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
    prevPage: vi.fn(),
    nextPage: vi.fn(),
  }),
  default: () => ({
    from: 0,
    to: 24,
    page: 1,
    pageSize: 25,
    totalCount: 3,
    setTotalCount: vi.fn(),
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
    prevPage: vi.fn(),
    nextPage: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mocks – utilities and services
// ---------------------------------------------------------------------------

vi.mock('@/utils/currencyService', () => ({
  getCurrencySymbol: () => 'EUR',
  formatCurrency: (amount) => `${Number(amount || 0).toFixed(2)} EUR`,
  formatCompactCurrency: (amount) => `${Number(amount || 0).toFixed(0)} EUR`,
}));

vi.mock('@/services/databaseCurrencyService', () => ({
  resolveAccountingCurrency: () => 'EUR',
}));

vi.mock('@/utils/calculations', () => ({
  formatNumber: (val) => String(val ?? 0),
}));

vi.mock('@/services/exportListsPDF', () => ({
  exportStockListPDF: vi.fn(),
  exportStockListHTML: vi.fn(),
}));

vi.mock('@/services/errorTracking', () => ({
  captureError: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mocks – UI components
// ---------------------------------------------------------------------------

vi.mock('react-helmet', () => ({
  Helmet: ({ children }) => <div data-testid="helmet">{children}</div>,
}));

vi.mock('@/components/CreditsGuardModal', () => ({
  default: () => null,
}));

vi.mock('@/components/ExportButton', () => ({
  default: () => <button data-testid="export-button">Export</button>,
}));

vi.mock('@/components/PaginationControls', () => ({
  default: () => <div data-testid="pagination-controls">Pagination</div>,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/stock' }),
}));

// Mock Tabs so ALL TabsContent children render simultaneously
// (Radix Tabs v1 only mounts the active tab by default)
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, ...rest }) => (
    <div data-testid="tabs" {...rest}>
      {children}
    </div>
  ),
  TabsList: ({ children, ...rest }) => (
    <div data-testid="tabs-list" {...rest}>
      {children}
    </div>
  ),
  TabsTrigger: ({ children, ...rest }) => <button {...rest}>{children}</button>,
  TabsContent: ({ children, ...rest }) => (
    <div data-testid="tabs-content" {...rest}>
      {children}
    </div>
  ),
}));

// Mock Select so dropdown children appear in the DOM
// (Radix Select renders content in a portal which is not available in jsdom)
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
}));

// ---------------------------------------------------------------------------
// Import the component under test (AFTER mocks)
// ---------------------------------------------------------------------------

import StockManagement from '@/pages/StockManagement';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StockManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing and displays the page title', () => {
    render(<StockManagement />);
    expect(screen.getByText('stockManagement.title')).toBeTruthy();
    expect(screen.getByText('stockManagement.subtitle')).toBeTruthy();
  });

  it('displays the product list with product names', () => {
    render(<StockManagement />);
    // Product names appear in multiple places (inventory table, cockpit cards, selects)
    expect(screen.getAllByText('Widget A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gadget B').length).toBeGreaterThan(0);
  });

  it('shows the search input field', () => {
    render(<StockManagement />);
    const searchInput = screen.getByPlaceholderText('common.search');
    expect(searchInput).toBeTruthy();
  });

  it('shows the "New product" button', () => {
    render(<StockManagement />);
    expect(screen.getByText('stockManagement.newProduct')).toBeTruthy();
  });

  it('shows export controls (export button, PDF and HTML)', () => {
    render(<StockManagement />);
    expect(screen.getByTestId('export-button')).toBeTruthy();
    expect(screen.getByText(/PDF/)).toBeTruthy();
    expect(screen.getByText(/HTML/)).toBeTruthy();
  });

  it('fetches alerts on mount', () => {
    render(<StockManagement />);
    expect(mockFetchAlerts).toHaveBeenCalled();
  });

  it('displays SKU values for products', () => {
    render(<StockManagement />);
    // SKU values appear in the inventory table and in cockpit composite text
    expect(screen.getAllByText(/WID-001/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/GAD-002/).length).toBeGreaterThan(0);
  });

  it('displays product category and supplier names', () => {
    render(<StockManagement />);
    // Category and supplier names appear in inventory table rows and category filter
    expect(screen.getAllByText('Widgets').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gadgets').length).toBeGreaterThan(0);
  });

  it('renders FIFO/CMUP/COGS valuation panel', () => {
    render(<StockManagement />);
    // The component uses t('stockManagement.cockpit.valuationTitle'); the global
    // test mock returns the key string as-is (see src/test/setup.js).
    expect(screen.getByText('stockManagement.cockpit.valuationTitle')).toBeTruthy();
  });

  it('renders multi-warehouse and lot/serial tab content', () => {
    render(<StockManagement />);
    // The component uses t('stockManagement.tabs.warehouses'); the global
    // test mock returns the key string as-is (see src/test/setup.js).
    expect(screen.getByText('stockManagement.tabs.warehouses')).toBeTruthy();
  });

  it('renders smart replenishment recommendation panel', () => {
    render(<StockManagement />);
    // The component uses t('stockManagement.cockpit.replenishmentTitle'); the global
    // test mock returns the key string as-is (see src/test/setup.js).
    expect(screen.getByText('stockManagement.cockpit.replenishmentTitle')).toBeTruthy();
  });
});
