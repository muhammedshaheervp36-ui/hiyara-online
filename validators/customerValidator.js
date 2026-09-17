/**
 * Customer Data Validator and Input Sanitizer
 */

function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim();
}

function validateCustomerPayload(payload) {
    const errors = [];

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {
            isValid: false,
            errors: [{ field: 'body', message: 'Invalid payload body. JSON object expected.' }],
            sanitized: null
        };
    }

    const { name, email, phone, address, status, totalOrders, totalSpent } = payload;

    // Validate Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        errors.push({ field: 'name', message: 'Name is required and must be at least 2 characters.' });
    } else if (name.trim().length > 100) {
        errors.push({ field: 'name', message: 'Name cannot exceed 100 characters.' });
    }

    // Validate Email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
        errors.push({ field: 'email', message: 'A valid email address is required (e.g. user@example.com).' });
    }

    // Validate Phone
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    if (!phone || typeof phone !== 'string' || (!phoneRegex.test(phone.trim()) || phone.replace(/\D/g, '').length < 7)) {
        errors.push({ field: 'phone', message: 'A valid phone number is required (e.g. +91 98765 43210).' });
    }

    // Validate Address
    if (!address || typeof address !== 'string' || address.trim().length < 5) {
        errors.push({ field: 'address', message: 'Address is required and must be at least 5 characters.' });
    } else if (address.trim().length > 300) {
        errors.push({ field: 'address', message: 'Address cannot exceed 300 characters.' });
    }

    // Validate Status
    const validStatuses = ['Active', 'Inactive', 'VIP', 'Pending'];
    const sanitizedStatus = status === undefined ? 'Active' : typeof status === 'string' ? status.trim() : '';
    if (!validStatuses.includes(sanitizedStatus)) {
        errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}.` });
    }

    // Validate Numbers if provided
    let numOrders = 0;
    if (totalOrders !== undefined && totalOrders !== null) {
        numOrders = Number(totalOrders);
        if (!['number', 'string'].includes(typeof totalOrders) || !Number.isSafeInteger(numOrders) || numOrders < 0) {
            errors.push({ field: 'totalOrders', message: 'Total orders must be a non-negative number.' });
        }
    }

    let numSpent = 0;
    if (totalSpent !== undefined && totalSpent !== null) {
        numSpent = Number(totalSpent);
        if (!['number', 'string'].includes(typeof totalSpent) || !Number.isFinite(numSpent) || numSpent < 0 || numSpent > Number.MAX_SAFE_INTEGER / 100) {
            errors.push({ field: 'totalSpent', message: 'Total spent must be a non-negative number.' });
        }
    }

    if (errors.length > 0) {
        return {
            isValid: false,
            errors,
            sanitized: null
        };
    }

    return {
        isValid: true,
        errors: [],
        sanitized: {
            name: name.trim(),
            email: email.trim().toLowerCase(), // Raw email stored lowercase for unique checks
            phone: phone.trim(),
            address: address.trim(),
            status: sanitizedStatus,
            ...(totalOrders != null ? { totalOrders: numOrders } : {}),
            ...(totalSpent != null ? { totalSpent: Math.round(numSpent * 100) / 100 } : {})
        }
    };
}

module.exports = {
    validateCustomerPayload,
    sanitizeString
};
