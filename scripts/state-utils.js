window.HiyaraState = {
    safeURL(value) {
        const url = String(value ?? '').trim();
        if (/^(https?:\/\/|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/i.test(url)) return this.escapeHTML(url);
        if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !/[\\\r\n]/.test(url)) return this.escapeHTML(url);
        return '';
    },
    escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    },
    read(defaults) {
        let stored;
        try { stored = JSON.parse(localStorage.getItem('hiyara_state_v1')); } catch { stored = null; }
        const state = structuredClone(defaults);
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) Object.assign(state, stored);
        for (const key of ['config', 'header', 'hero', 'about', 'contact']) {
            state[key] = { ...defaults[key], ...(state[key] && typeof state[key] === 'object' && !Array.isArray(state[key]) ? state[key] : {}) };
        }
        for (const key of ['bestSellers', 'collections', 'orders', 'customers', 'favorites', 'cart']) {
            if (!Array.isArray(state[key])) state[key] = structuredClone(defaults[key] || []);
        }
        if (!Array.isArray(state.header.menuItems)) state.header.menuItems = [...defaults.header.menuItems];
        state.cart = state.cart.filter(i => i && typeof i === 'object').map(i => ({...i,
            price: String(i.price ?? '0'), quantity: Number.isInteger(i.quantity) && i.quantity > 0 ? i.quantity : 1,
            variant: i.variant || {size:'Standard', color:'Gold'} }));
        state.bestSellers = state.bestSellers.filter(p => p && typeof p === 'object').map(p => ({...p, price:String(p.price ?? '0'), category:String(p.category || 'Other'), name:String(p.name || 'Product')}));
        return state;
    }
};
