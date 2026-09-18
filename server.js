/**
 * Hiyara Web Application Server & Admin API Service
 * Built with native Node.js HTTP module
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const Store = require('./database/store');
const SessionService = require('./services/sessionService');
const RazorpayService = require('./services/razorpayService');
const { verifyPassword } = require('./services/passwordService');
const { verifyAdminAuth } = require('./middleware/auth');
const { validateCustomerPayload } = require('./validators/customerValidator');
const { logAdminAction } = require('./services/auditLogger');

const PORT = process.env.PORT || 3001;

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Role');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function sendJsonResponse(res, statusCode, body, customHeaders = {}) {
    setCorsHeaders(res);
    for (const [key, value] of Object.entries(customHeaders)) {
        res.setHeader(key, value);
    }
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > 1e6) { // 1MB size limit
                req.destroy();
                reject(new Error('Payload too large'));
            }
        });
        req.on('end', () => {
            try {
                if (!body.trim()) {
                    resolve({});
                } else {
                    resolve(JSON.parse(body));
                }
            } catch (err) {
                reject(new Error('Invalid JSON format'));
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3001'}`);
    const pathname = reqUrl.pathname;
    const method = req.method.toUpperCase();

    // Handle CORS preflight
    if (method === 'OPTIONS') {
        setCorsHeaders(res);
        res.writeHead(204);
        return res.end();
    }

    // --- PUBLIC AUTHENTICATION ROUTES ---

    // POST /api/admin/login
    if (pathname === '/api/admin/login' && method === 'POST') {
        try {
            const { email, password } = await parseRequestBody(req);

            if (!email || !password) {
                return sendJsonResponse(res, 400, {
                    success: false,
                    error: 'Email and password are required.'
                });
            }

            const user = Store.getUserByEmail(email);
            if (!user) {
                return sendJsonResponse(res, 401, {
                    success: false,
                    error: 'Invalid credentials. User account not found.'
                });
            }

            // Verify salted scrypt password
            const isPasswordValid = verifyPassword(password, user.passwordHash);
            if (!isPasswordValid) {
                return sendJsonResponse(res, 401, {
                    success: false,
                    error: 'Invalid credentials. Password verification failed.'
                });
            }

            // RBAC Check: Verify Admin or Superadmin Role
            if (user.role !== 'admin' && user.role !== 'superadmin') {
                return sendJsonResponse(res, 403, {
                    success: false,
                    error: `Forbidden: User account role '${user.role}' is not authorized to access the admin portal.`
                });
            }

            // Create Session & Build HttpOnly Cookie
            const session = SessionService.createSession(user);
            const cookieHeader = SessionService.buildSessionCookieHeader(session.token);

            // Record Login Audit Event
            logAdminAction({
                adminUser: user.name,
                action: 'ADMIN_LOGIN',
                customerId: user.id,
                changes: { email: user.email, role: user.role },
                ipAddress: req.socket.remoteAddress
            });

            return sendJsonResponse(res, 200, {
                success: true,
                message: 'Authentication successful.',
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            }, { 'Set-Cookie': cookieHeader });
        } catch (err) {
            return sendJsonResponse(res, 500, { success: false, error: err.message });
        }
    }

    // POST /api/admin/logout
    if (pathname === '/api/admin/logout' && method === 'POST') {
        const cookies = SessionService.parseCookies(req);
        const token = cookies[SessionService.COOKIE_NAME];
        if (token) {
            SessionService.destroySession(token);
        }
        const logoutCookieHeader = SessionService.buildLogoutCookieHeader();
        return sendJsonResponse(res, 200, {
            success: true,
            message: 'Logged out successfully.'
        }, { 'Set-Cookie': logoutCookieHeader });
    }

    // GET /api/admin/me (Session check endpoint)
    if (pathname === '/api/admin/me' && method === 'GET') {
        const auth = verifyAdminAuth(req, { requireAdminRole: false });
        if (!auth.authorized) {
            return sendJsonResponse(res, auth.statusCode, { success: false, error: auth.error });
        }
        return sendJsonResponse(res, 200, {
            success: true,
            user: auth.user
        });
    }

    // --- RAZORPAY PAYMENT GATEWAY ROUTES ---

    // GET /api/razorpay-config (Expose public Key ID to frontend)
    if (pathname === '/api/razorpay-config' && method === 'GET') {
        return sendJsonResponse(res, 200, {
            success: true,
            keyId: RazorpayService.getKeyId()
        });
    }

    // POST /api/create-razorpay-order (Create order for UPI / GPay / Card checkout)
    if (pathname === '/api/create-razorpay-order' && method === 'POST') {
        try {
            const payload = await parseRequestBody(req);
            const { amount, currency, receipt, notes } = payload;

            if (amount === undefined || amount === null || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
                return sendJsonResponse(res, 400, {
                    success: false,
                    error: 'A valid order amount greater than 0 is required.'
                });
            }

            const order = await RazorpayService.createOrder({
                amount: parseFloat(amount),
                currency: currency || 'INR',
                receipt,
                notes: notes || {}
            });

            return sendJsonResponse(res, 200, {
                success: true,
                order
            });
        } catch (err) {
            return sendJsonResponse(res, 500, {
                success: false,
                error: err.message
            });
        }
    }

    // POST /api/verify-razorpay-payment (HMAC SHA-256 Signature Verification)
    if (pathname === '/api/verify-razorpay-payment' && method === 'POST') {
        try {
            const payload = await parseRequestBody(req);
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDetails } = payload;

            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                return sendJsonResponse(res, 400, {
                    success: false,
                    verified: false,
                    error: 'Missing required parameters (razorpay_order_id, razorpay_payment_id, razorpay_signature).'
                });
            }

            const isValid = RazorpayService.verifyPaymentSignature({
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
            });

            if (!isValid) {
                return sendJsonResponse(res, 400, {
                    success: false,
                    verified: false,
                    error: 'Payment verification failed: Invalid HMAC SHA-256 signature.'
                });
            }

            // Structured audit log for successful payment
            logAdminAction({
                adminUser: orderDetails?.customer || 'Customer Checkout',
                action: 'PAYMENT_VERIFIED',
                customerId: razorpay_payment_id,
                changes: {
                    orderId: razorpay_order_id,
                    paymentId: razorpay_payment_id,
                    method: orderDetails?.paymentMethod || 'Razorpay UPI / Google Pay',
                    amount: orderDetails?.summary?.total || null
                },
                ipAddress: req.socket.remoteAddress
            });

            return sendJsonResponse(res, 200, {
                success: true,
                verified: true,
                message: 'Payment signature verified successfully.',
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id
            });
        } catch (err) {
            return sendJsonResponse(res, 500, {
                success: false,
                verified: false,
                error: err.message
            });
        }
    }

    // --- PROTECTED ADMIN API ROUTES ---

    // GET /api/admin/customers
    if (pathname === '/api/admin/customers' && method === 'GET') {
        const auth = verifyAdminAuth(req, { requireAdminRole: false });
        if (!auth.authorized) {
            return sendJsonResponse(res, auth.statusCode, { success: false, error: auth.error });
        }
        try {
            const customers = Store.getAllCustomers();
            return sendJsonResponse(res, 200, { success: true, count: customers.length, customers });
        } catch (err) {
            return sendJsonResponse(res, 500, { success: false, error: err.message });
        }
    }

    // POST /api/admin/customers (Create new customer)
    if (pathname === '/api/admin/customers' && method === 'POST') {
        const auth = verifyAdminAuth(req, { requireAdminRole: true });
        if (!auth.authorized) {
            return sendJsonResponse(res, auth.statusCode, { success: false, error: auth.error });
        }

        try {
            const payload = await parseRequestBody(req);
            const validation = validateCustomerPayload(payload);

            if (!validation.isValid) {
                return sendJsonResponse(res, 400, {
                    success: false,
                    error: 'Validation failed.',
                    details: validation.errors
                });
            }

            const newCustomer = Store.saveCustomer(validation.sanitized, false);

            logAdminAction({
                adminUser: auth.user.name,
                action: 'CUSTOMER_CREATED',
                customerId: newCustomer.id,
                changes: validation.sanitized,
                ipAddress: req.socket.remoteAddress
            });

            return sendJsonResponse(res, 201, {
                success: true,
                message: 'Customer saved successfully.',
                customer: newCustomer
            });
        } catch (err) {
            const statusCode = err.statusCode || 500;
            return sendJsonResponse(res, statusCode, {
                success: false,
                error: err.message,
                code: err.code || 'INTERNAL_ERROR'
            });
        }
    }

    // PUT /api/admin/customers/:id (Update existing customer)
    if (pathname.startsWith('/api/admin/customers/') && method === 'PUT') {
        const auth = verifyAdminAuth(req, { requireAdminRole: true });
        if (!auth.authorized) {
            return sendJsonResponse(res, auth.statusCode, { success: false, error: auth.error });
        }

        const customerId = decodeURIComponent(pathname.replace('/api/admin/customers/', ''));
        if (!customerId) {
            return sendJsonResponse(res, 400, { success: false, error: 'Customer ID required in URL path.' });
        }

        try {
            const payload = await parseRequestBody(req);
            const validation = validateCustomerPayload(payload);

            if (!validation.isValid) {
                return sendJsonResponse(res, 400, {
                    success: false,
                    error: 'Validation failed.',
                    details: validation.errors
                });
            }

            const updatedCustomer = Store.saveCustomer(validation.sanitized, true, customerId);

            logAdminAction({
                adminUser: auth.user.name,
                action: 'CUSTOMER_UPDATED',
                customerId: updatedCustomer.id,
                changes: validation.sanitized,
                ipAddress: req.socket.remoteAddress
            });

            return sendJsonResponse(res, 200, {
                success: true,
                message: 'Customer updated successfully.',
                customer: updatedCustomer
            });
        } catch (err) {
            const statusCode = err.statusCode || 500;
            return sendJsonResponse(res, statusCode, {
                success: false,
                error: err.message,
                code: err.code || 'INTERNAL_ERROR'
            });
        }
    }

    // DELETE /api/admin/customers/:id
    if (pathname.startsWith('/api/admin/customers/') && method === 'DELETE') {
        const auth = verifyAdminAuth(req, { requireAdminRole: true });
        if (!auth.authorized) {
            return sendJsonResponse(res, auth.statusCode, { success: false, error: auth.error });
        }

        const customerId = decodeURIComponent(pathname.replace('/api/admin/customers/', ''));
        try {
            const deleted = Store.deleteCustomer(customerId);
            if (!deleted) {
                return sendJsonResponse(res, 404, { success: false, error: `Customer '${customerId}' not found.` });
            }

            logAdminAction({
                adminUser: auth.user.name,
                action: 'CUSTOMER_DELETED',
                customerId,
                changes: null,
                ipAddress: req.socket.remoteAddress
            });

            return sendJsonResponse(res, 200, { success: true, message: `Customer '${customerId}' deleted.` });
        } catch (err) {
            return sendJsonResponse(res, 500, { success: false, error: err.message });
        }
    }

    // GET /api/admin/audit-logs
    if (pathname === '/api/admin/audit-logs' && method === 'GET') {
        const auth = verifyAdminAuth(req, { requireAdminRole: true });
        if (!auth.authorized) {
            return sendJsonResponse(res, auth.statusCode, { success: false, error: auth.error });
        }

        try {
            const logs = Store.getAuditLogs();
            return sendJsonResponse(res, 200, { success: true, count: logs.length, logs });
        } catch (err) {
            return sendJsonResponse(res, 500, { success: false, error: err.message });
        }
    }

    // --- STATIC FILES SERVER & ROUTE GUARD ---

    // Route Protection for Admin Dashboard HTML
    if (pathname === '/admin' || pathname === '/admin.html') {
        const auth = verifyAdminAuth(req, { requireAdminRole: false });
        if (!auth.authorized) {
            // Redirect unauthenticated browser requests to login page
            res.writeHead(302, { 'Location': '/admin-login.html' });
            return res.end();
        }
    }

    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            return sendJsonResponse(res, 404, { success: false, error: 'Resource not found' });
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
}

module.exports = server;
