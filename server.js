/**
 * Hiyara Web Application Server & Admin API Service
 * Built with native Node.js HTTP module
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const Store = require('./database/store');
const SessionService = require('./services/sessionService');
const { verifyPassword } = require('./services/passwordService');
const { verifyAdminAuth } = require('./middleware/auth');
const { validateCustomerPayload } = require('./validators/customerValidator');
const { logAdminAction } = require('./services/auditLogger');

const PORT = process.env.PORT || 3001;

function setCorsHeaders(res) {
    // The storefront and API share an origin; do not expose admin APIs cross-origin.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
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
        const chunks = [];
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size <= 1e6) chunks.push(chunk);
        });
        req.on('end', () => {
            if (size > 1e6) return reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
            try {
                const body = Buffer.concat(chunks).toString('utf8');
                const data = body.trim() ? JSON.parse(body) : {};
                if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
                resolve(data);
            } catch {
                reject(Object.assign(new Error('A valid JSON object is required.'), { statusCode: 400 }));
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    try {
    const reqUrl = new URL(req.url, 'http://localhost');
    let pathname;
    try { pathname = decodeURIComponent(reqUrl.pathname); }
    catch { return sendJsonResponse(res, 400, { success: false, error: 'Invalid URL encoding.' }); }
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

            if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || email.length > 254 || password.length > 1024) {
                return sendJsonResponse(res, 400, {
                    success: false,
                    error: 'Email and password are required.'
                });
            }

            const user = Store.getUserByEmail(email.trim());
            if (!user) {
                return sendJsonResponse(res, 401, {
                    success: false,
                    error: 'Invalid email or password.'
                });
            }

            // Verify salted scrypt password
            const isPasswordValid = verifyPassword(password, user.passwordHash);
            if (!isPasswordValid) {
                return sendJsonResponse(res, 401, {
                    success: false,
                    error: 'Invalid email or password.'
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
            return sendJsonResponse(res, err.statusCode || 500, { success: false, error: err.statusCode ? err.message : 'Internal server error.' });
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
            return sendJsonResponse(res, err.statusCode || 500, { success: false, error: err.statusCode ? err.message : 'Internal server error.' });
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

        const customerId = pathname.replace('/api/admin/customers/', '');
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

        const customerId = pathname.replace('/api/admin/customers/', '');
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
            return sendJsonResponse(res, err.statusCode || 500, { success: false, error: err.statusCode ? err.message : 'Internal server error.' });
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
            return sendJsonResponse(res, err.statusCode || 500, { success: false, error: err.statusCode ? err.message : 'Internal server error.' });
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

    if (!['GET', 'HEAD'].includes(method)) {
        return sendJsonResponse(res, 405, { success: false, error: 'Method not allowed.' }, { Allow: 'GET, HEAD' });
    }
    const relative = pathname === '/' ? 'index.html' : pathname === '/admin' ? 'admin.html' : pathname.slice(1);
    const pages = new Set(['index.html', 'admin.html', 'admin-login.html']);
    const allowedAsset = /^(assets|styles|scripts)\/[a-zA-Z0-9_ .\/-]+$/.test(relative)
        && /\.(css|js|png|jpe?g|webp|gif|svg|ico|ttf|woff2?)$/i.test(relative)
        && (!relative.startsWith('scripts/') || ['scripts/app.js', 'scripts/state-utils.js'].includes(relative)) && !relative.includes('..');
    const filePath = path.resolve(__dirname, relative);
    if ((!pages.has(relative) && !allowedAsset) || !filePath.startsWith(__dirname + path.sep)) {
        return sendJsonResponse(res, 404, { success: false, error: 'Resource not found.' });
    }
    let content;
    try { content = await fs.promises.readFile(filePath); }
    catch { return sendJsonResponse(res, 404, { success: false, error: 'Resource not found.' }); }
    const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff',
        '.woff2': 'font/woff2', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Length': content.length });
    res.end(method === 'HEAD' ? undefined : content);
    } catch (err) {
        console.error('Request failed:', err.message);
        if (!res.headersSent) sendJsonResponse(res, 500, { success: false, error: 'Internal server error.' });
        else res.end();
    }
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
}

module.exports = server;
