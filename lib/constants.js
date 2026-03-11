const SCOPES = {
    OPENID: 'openid',
    PROFILE: 'profile',
    EMAIL: 'email',
    PHONE: 'phone',
    STORE: 'store',
};

const TOKEN_PREFIXES = {
    CLIENT_ID: 'sx_oc_',
    CLIENT_SECRET: 'sx_os_',
    AUTH_CODE: 'sx_ic_',
    ACCESS_TOKEN: 'sx_it_',
    REFRESH_TOKEN: 'sx_ir_',
};

const ENDPOINTS = {
    DISCOVERY: '/.well-known/openid-configuration',
    AUTHORIZE: '/api/oauth/authorize',
    CONSENT: '/api/oauth/authorize/consent',
    TOKEN: '/api/oauth/token',
    USERINFO: '/api/oauth/userinfo',
    REVOKE: '/api/oauth/revoke',
    CLIENTS: '/api/oauth/clients',
};

const DEFAULT_SCOPES = ['openid', 'profile', 'email'];

const RESOURCE_SCOPES = {
    'read:orders': { resource: 'orders', action: 'read', label: 'Read Orders', description: 'View orders and order details' },
    'write:orders': { resource: 'orders', action: 'write', label: 'Write Orders', description: 'Create, update, and delete orders' },
    'read:products': { resource: 'products', action: 'read', label: 'Read Products', description: 'View products and product details' },
    'write:products': { resource: 'products', action: 'write', label: 'Write Products', description: 'Create, update, and delete products' },
    'read:customers': { resource: 'customers', action: 'read', label: 'Read Customers', description: 'View customer information' },
    'write:customers': { resource: 'customers', action: 'write', label: 'Write Customers', description: 'Create, update, and delete customers' },
    'read:categories': { resource: 'categories', action: 'read', label: 'Read Categories', description: 'View product categories' },
    'write:categories': { resource: 'categories', action: 'write', label: 'Write Categories', description: 'Create, update, and delete categories' },
    'read:inventory': { resource: 'inventory', action: 'read', label: 'Read Inventory', description: 'View stock levels and inventory data' },
    'write:inventory': { resource: 'inventory', action: 'write', label: 'Write Inventory', description: 'Update stock levels and inventory' },
    'read:analytics': { resource: 'analytics', action: 'read', label: 'Read Analytics', description: 'View store analytics and reports' },
    'read:settings': { resource: 'settings', action: 'read', label: 'Read Settings', description: 'View store settings and configuration' },
    'write:settings': { resource: 'settings', action: 'write', label: 'Write Settings', description: 'Modify store settings and configuration' },
    'read:pages': { resource: 'pages', action: 'read', label: 'Read Pages', description: 'View store pages and content' },
    'write:pages': { resource: 'pages', action: 'write', label: 'Write Pages', description: 'Create, update, and delete pages' },
    'read:tickets': { resource: 'tickets', action: 'read', label: 'Read Tickets', description: 'View support tickets' },
    'write:tickets': { resource: 'tickets', action: 'write', label: 'Write Tickets', description: 'Create, update, and manage tickets' },
    'read:coupons': { resource: 'coupons', action: 'read', label: 'Read Coupons', description: 'View discount coupons' },
    'write:coupons': { resource: 'coupons', action: 'write', label: 'Write Coupons', description: 'Create, update, and delete coupons' },
    'read:shipping': { resource: 'shipping', action: 'read', label: 'Read Shipping', description: 'View shipping configuration and rates' },
    'write:shipping': { resource: 'shipping', action: 'write', label: 'Write Shipping', description: 'Modify shipping configuration and rates' },
};

const SCOPE_GROUPS = {
    orders: { label: 'Orders', description: 'Access to store orders', read: 'read:orders', write: 'write:orders', icon: 'Package' },
    products: { label: 'Products', description: 'Access to store products', read: 'read:products', write: 'write:products', icon: 'ShoppingBag' },
    customers: { label: 'Customers', description: 'Access to customer data', read: 'read:customers', write: 'write:customers', icon: 'Users' },
    categories: { label: 'Categories', description: 'Access to product categories', read: 'read:categories', write: 'write:categories', icon: 'FolderTree' },
    inventory: { label: 'Inventory', description: 'Access to stock levels', read: 'read:inventory', write: 'write:inventory', icon: 'Warehouse' },
    analytics: { label: 'Analytics', description: 'Access to store analytics', read: 'read:analytics', write: null, icon: 'BarChart3' },
    settings: { label: 'Settings', description: 'Access to store settings', read: 'read:settings', write: 'write:settings', icon: 'Settings' },
    pages: { label: 'Pages', description: 'Access to store pages', read: 'read:pages', write: 'write:pages', icon: 'FileText' },
    tickets: { label: 'Tickets', description: 'Access to support tickets', read: 'read:tickets', write: 'write:tickets', icon: 'Ticket' },
    coupons: { label: 'Coupons', description: 'Access to discount coupons', read: 'read:coupons', write: 'write:coupons', icon: 'Tag' },
    shipping: { label: 'Shipping', description: 'Access to shipping config', read: 'read:shipping', write: 'write:shipping', icon: 'Truck' },
};

const ALL_VALID_SCOPES = [
    ...Object.values(SCOPES),
    ...Object.keys(RESOURCE_SCOPES),
];

module.exports = { SCOPES, TOKEN_PREFIXES, ENDPOINTS, DEFAULT_SCOPES, RESOURCE_SCOPES, SCOPE_GROUPS, ALL_VALID_SCOPES };
