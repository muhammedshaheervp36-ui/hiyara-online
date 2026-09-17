const SessionService = require('../services/sessionService');
const Store = require('../database/store');

function verifyAdminAuth(req) {
    const cookies = SessionService.parseCookies(req);
    const token = cookies[SessionService.COOKIE_NAME] || (req.headers.authorization || '').replace(/^Bearer /, '');
    const session = SessionService.getSession(token);
    if (!session) return { authorized: false, statusCode: 401, error: 'A valid admin session is required.' };
    // Resolve the current account so deletion or role changes take effect immediately.
    const user = Store.getUserById(session.userId);
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
        return { authorized: false, statusCode: 403, error: 'Admin access is required.' };
    }
    return { authorized: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}
module.exports = { verifyAdminAuth };
