/**
 * Structured Audit Trail Logger Service
 */

const Store = require('../database/store');

function logAdminAction({ adminUser, action, customerId, changes, ipAddress }) {
    const entry = {
        adminUser: adminUser || 'System Admin',
        action, // 'CUSTOMER_CREATED' | 'CUSTOMER_UPDATED' | 'CUSTOMER_DELETED'
        customerId,
        changes,
        ipAddress: ipAddress || '127.0.0.1'
    };

    console.log(`[AUDIT LOG] [${new Date().toISOString()}] Admin '${entry.adminUser}' executed '${action}' on customer '${customerId}'`);
    return Store.addAuditLog(entry);
}

module.exports = {
    logAdminAction
};
