const fs = require('fs');
const path = require('path');
const { hashPassword } = require('../services/passwordService');

const DATA_DIR = process.env.HIYARA_DATA_DIR || path.join(__dirname, '..', 'data');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_logs.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Accounts are created explicitly with npm run setup-admin.
const initialUsers = [];
const initialCustomers = [];

function readJsonFile(filePath, fallback = []) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
            return fallback;
        }
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        throw err;
    }
}

function writeJsonFile(filePath, data) {
    const temp = filePath + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, filePath);
}

// Store API
const Store = {
    // --- USER / ADMIN ACCOUNT MANAGEMENT ---
    getAllUsers() {
        return readJsonFile(USERS_FILE, initialUsers);
    },

    getUserByEmail(email) {
        if (!email) return null;
        const users = this.getAllUsers();
        return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    },

    getUserById(id) {
        const users = this.getAllUsers();
        return users.find(u => u.id === id) || null;
    },

    saveUser(userData) {
        const users = this.getAllUsers();
        const existingIdx = users.findIndex(u => u.id === userData.id || u.email.toLowerCase() === userData.email.toLowerCase());

        if (existingIdx !== -1) {
            users[existingIdx] = {
                ...users[existingIdx],
                ...userData,
                updatedAt: new Date().toISOString()
            };
        } else {
            const newUser = {
                id: userData.id || `USR-${Date.now()}`,
                name: userData.name,
                email: userData.email.toLowerCase(),
                passwordHash: userData.passwordHash,
                role: userData.role || 'staff',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            users.push(newUser);
        }
        writeJsonFile(USERS_FILE, users);
    },

    // --- CUSTOMERS MANAGEMENT ---
    getAllCustomers() {
        return readJsonFile(CUSTOMERS_FILE, initialCustomers);
    },

    getCustomerById(id) {
        const customers = this.getAllCustomers();
        return customers.find(c => c.id === id) || null;
    },

    getCustomerByEmail(email) {
        const customers = this.getAllCustomers();
        return customers.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
    },

    saveCustomer(customerData, isUpdate = false, existingId = null) {
        const customers = this.getAllCustomers();

        // Unique constraint check for duplicate email
        const existingWithEmail = customers.find(c =>
            c.email.toLowerCase() === customerData.email.toLowerCase() &&
            (!isUpdate || c.id !== existingId)
        );

        if (existingWithEmail) {
            const error = new Error(`Customer with email '${customerData.email}' already exists.`);
            error.code = 'DUPLICATE_EMAIL';
            error.statusCode = 409;
            throw error;
        }

        let savedCustomer;

        if (isUpdate && existingId) {
            const index = customers.findIndex(c => c.id === existingId);
            if (index === -1) {
                const error = new Error(`Customer with ID '${existingId}' not found.`);
                error.code = 'NOT_FOUND';
                error.statusCode = 404;
                throw error;
            }

            savedCustomer = {
                ...customers[index],
                ...customerData,
                id: existingId,
                updatedAt: new Date().toISOString()
            };
            customers[index] = savedCustomer;
        } else {
            // Create new customer
            const nextIdNumber = customers.reduce((max, c) => {
                const num = parseInt(c.id.replace('CUST-', ''), 10);
                return num > max ? num : max;
            }, 1000) + 1;

            const newId = customerData.id || `CUST-${nextIdNumber}`;

            savedCustomer = {
                id: newId,
                name: customerData.name,
                email: customerData.email,
                phone: customerData.phone,
                address: customerData.address,
                status: customerData.status || 'Active',
                totalOrders: customerData.totalOrders || 0,
                totalSpent: customerData.totalSpent || 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            customers.push(savedCustomer);
        }

        writeJsonFile(CUSTOMERS_FILE, customers);
        return savedCustomer;
    },

    deleteCustomer(id) {
        let customers = this.getAllCustomers();
        const initialLength = customers.length;
        customers = customers.filter(c => c.id !== id);
        if (customers.length === initialLength) {
            return false;
        }
        writeJsonFile(CUSTOMERS_FILE, customers);
        return true;
    },

    // --- AUDIT LOGS ---
    getAuditLogs() {
        return readJsonFile(AUDIT_FILE, []);
    },

    addAuditLog(entry) {
        const logs = this.getAuditLogs();
        const logRecord = {
            id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date().toISOString(),
            ...entry
        };
        logs.unshift(logRecord);
        writeJsonFile(AUDIT_FILE, logs);
        return logRecord;
    }
};

module.exports = Store;
