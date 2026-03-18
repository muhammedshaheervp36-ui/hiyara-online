/**
 * Hiyara Application State and Component Initialization
 */

const defaultState = {
    config: {
        primaryColor: '#F5F1EB',
        accentColor: '#C5A059',
        textColor: '#111111',
        fontFamily: "'Sirenik', 'Sirenik Regular', serif"
    },
    header: {
        logo: 'Hiyara',
        menuItems: ['Home', 'Shop', 'Collections', 'About', 'Contact'],
        showIcons: true
    },
    hero: {
        heading: 'Timeless Elegance, Crafted for You.',
        subheading: 'Exquisite jewelry that tells your story with grace and sophistication.',
        buttonText: 'Shop Now',
        image: 'assets/hero-bg.jpg'
    },
    collections: [
        { name: 'Necklaces', label: 'Luminous Strands', img: 'WhatsApp Image 2026-02-18 at 7.54.06 PM.jpeg' },
        { name: 'Earrings', label: 'Ethereal Drops', img: 'WhatsApp Image 2026-02-18 at 7.58.19 PM.jpeg' },
        { name: 'Rings', label: 'Eternal Circles', img: 'WhatsApp Image 2026-02-18 at 7.58.20 PM.jpeg' },
        { name: 'Bracelets', label: 'Delicate Chains', img: 'WhatsApp Image 2026-02-18 at 7.58.23 PM.jpeg' }
    ],
    bestSellers: [
        { id: 1, name: 'Golden Solitaire Ring', price: '₹95,000', category: 'Rings', img: 'FFF.jpeg' },
        { id: 2, name: 'Diamond Drop Earrings', price: '₹1,50,000', category: 'Earrings', img: 'WhatsApp Image 2026-02-18 at 7.58.19 PM.jpeg' },
        { id: 3, name: 'Pearl Essence Necklace', price: '₹68,000', category: 'Necklaces', img: 'WhatsApp Image 2026-02-18 at 7.54.06 PM.jpeg' },
        { id: 4, name: 'Aura Gold Bangle', price: '₹1,25,000', category: 'Bracelets', img: 'WhatsApp Image 2026-02-18 at 7.58.23 PM.jpeg' }
    ],
    about: {
        title: 'The Art of Elegance',
        text: 'Founded on the principles of timeless beauty and exceptional craftsmanship, Hiyara creates more than just jewelry. We create heirlooms that capture the essence of your most precious moments.',
        img: 'WhatsApp Image 2026-02-18 at 7.54.06 PM.jpeg'
    },
    social: {
        instagram: '',
        whatsapp: '',
        facebook: ''
    }
};

let state = JSON.parse(localStorage.getItem('hiyara_state_v1')) || defaultState;

if (!state.social) {
    state.social = defaultState.social;
    localStorage.setItem('hiyara_state_v1', JSON.stringify(state));
}

if (state.config && state.config.fontFamily !== "'Sirenik', 'Sirenik Regular', serif") {
    state.config.fontFamily = "'Sirenik', 'Sirenik Regular', serif";
    localStorage.setItem('hiyara_state_v1', JSON.stringify(state));
}

const createPlaceholder = (width, height, text) => {
    const bg = '#F5F1EB';
    const color = '#C5A059';
    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${bg}"/>
        <text x="50%" y="50%" font-family="serif" font-size="24" fill="${color}" text-anchor="middle" dominant-baseline="middle">${text}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// Apply placeholders
if (!state.hero.image) state.hero.image = createPlaceholder(1920, 1080, 'Timeless Elegance');
if (state.collections) state.collections.forEach(c => { if (!c.img) c.img = createPlaceholder(400, 600, c.name) });
if (state.bestSellers) state.bestSellers.forEach(p => { if (!p.img) p.img = createPlaceholder(400, 400, p.name) });
if (state.about && !state.about.img) state.about.img = createPlaceholder(800, 600, 'Our Story');

const components = {
    renderHeader() {
        return `
            <header class="sticky-header">
                <div class="container header-content">
                    <div class="logo-container">
                        <a href="/" class="brand-logo">${state.header.logo}</a>
                    </div>
                    <nav class="main-nav">
                        <ul>
                            ${state.header.menuItems.map(item => `<li><a href="#${item.toLowerCase()}">${item}</a></li>`).join('')}
                        </ul>
                    </nav>
                    <div class="header-icons">
                        <button class="icon-btn search-btn" aria-label="Search"><svg ...></svg></button>
                        <button class="icon-btn wishlist-btn" aria-label="Wishlist"><svg ...></svg></button>
                        <button class="icon-btn account-btn" aria-label="Account"><svg ...></svg></button>
                        <button class="icon-btn cart-btn" aria-label="Cart"><svg ...></svg></button>
                    </div>
                </div>
            </header>
        `;
    },

    renderHero() {
        return `
            <section class="hero-section">
                <div class="hero-overlay"></div>
                <div class="hero-content container">
                    <h1 class="hero-heading slide-up">${state.hero.heading}</h1>
                    <p class="hero-subheading slide-up-delayed">${state.hero.subheading}</p>
                    <a href="#shop" class="gold-btn slide-up-delayed-more">${state.hero.buttonText}</a>
                </div>
            </section>
        `;
    },

    renderCollections() {
        return `
            <section class="container">
                <h2 class="section-title">Featured Collections</h2>
                <div class="collections-grid">
                    ${state.collections.map(item => `
                        <div class="collection-card">
                            <img src="${item.img}" alt="${item.name}" class="collection-img">
                            <div class="collection-overlay">
                                <span>${item.label}</span>
                                <h3>${item.name}</h3>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    },

    renderBestSellers() {
        return `
            <section class="container">
                <h2 class="section-title">Best Sellers</h2>
                <div class="products-grid">
                    ${state.bestSellers.map(product => `
                        <div class="product-card">
                            <div class="product-image-wrap">
                                <img src="${product.img}" alt="${product.name}" style="height:100%; width:100%; object-fit:contain;">
                            </div>
                            <div class="product-info">
                                <p class="product-category">${product.category}</p>
                                <h3 class="product-name">${product.name}</h3>
                                <p class="product-price">${product.price}</p>
                                <button class="add-to-cart-simple" onclick="openProduct(${product.id})">View Details</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    },

    renderAbout() {
        return `
            <section class="container">
                <div class="about-grid">
                    <div class="about-text">
                        <span>Our Story</span>
                        <h2>${state.about.title}</h2>
                        <p class="brand-story">${state.about.text}</p>
                        <a href="#about" class="gold-btn">Learn More</a>
                    </div>
                    <div class="about-img">
                        <img src="${state.about.img}" alt="Brand Story">
                    </div>
                </div>
            </section>
        `;
    },

    renderNewsletter() {
        return `
            <section class="newsletter-section">
                <div class="newsletter-content container">
                    <h2>Join the World of Hiyara</h2>
                    <p>Subscribe to receive updates on new collections and exclusive events.</p>
                    <form class="newsletter-form">
                        <input type="email" placeholder="Email Address" class="newsletter-input">
                        <button type="submit" class="newsletter-btn">Subscribe</button>
                    </form>
                </div>
            </section>
        `;
    },




    renderEditor() {
        return `
            <button class="editor-toggle" id="editorToggle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <div class="editor-panel" id="editorPanel">
                <h3>Global Customizer</h3>
                <div class="editor-group">
                    <h4>General Styles</h4>
                    <div class="editor-field">
                        <label>Logo Text</label>
                        <input type="text" value="${state.header.logo}" oninput="updateConfig('header.logo', this.value)">
                    </div>
                </div>
                <div class="editor-group">
                    <h4>Hero Section</h4>
                    <div class="editor-field">
                        <label>Hero Heading</label>
                        <textarea oninput="updateConfig('hero.heading', this.value)">${state.hero.heading}</textarea>
                    </div>
                </div>
            </div>
        `;
    },

    renderProductModal() {
        return `
            <div class="product-modal" id="productModal">
                <span class="close-modal" onclick="closeProduct()">&times;</span>
                <div id="modalContent"></div>
            </div>
        `;
    }
};

window.updateConfig = (path, value) => {
    const keys = path.split('.');
    let obj = state;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
    initApp();
};

window.openProduct = (id) => {
    const product = state.bestSellers.find(p => p.id === id);
    const modal = document.getElementById('productModal');
    const content = document.getElementById('modalContent');
    content.innerHTML = `
        <div class="product-detail-grid">
            <div class="product-gallery">
                <img src="${product.img}" alt="${product.name}">
            </div>
            <div class="product-info-panel">
                <h1>${product.name}</h1>
                <p class="product-detail-price">${product.price}</p>
                <div class="product-description">
                    Premium quality ${product.category.toLowerCase()} crafted from ethically sourced materials.
                </div>
                <div class="product-variants">
                    <div class="variant-group">
                        <label>Size</label>
                        <div class="variant-options">
                            <div class="variant-chip active">Standard</div>
                            <div class="variant-chip">Custom</div>
                        </div>
                    </div>
                </div>
                <button class="gold-btn" style="width: 100%">Add to Bag</button>
            </div>
        </div>
    `;
    modal.classList.add('active');
};

window.closeProduct = () => {
    document.getElementById('productModal').classList.remove('active');
};

function initApp() {
    const app = document.getElementById('app');
    app.innerHTML = `
        ${components.renderHeader()}
        <main>
            ${components.renderHero()}
            ${components.renderCollections()}
            ${components.renderBestSellers()}
            ${components.renderAbout()}
            ${components.renderNewsletter()}
        </main>
        ${components.renderFooter()}
        ${components.renderEditor()}
        ${components.renderProductModal()}
    `;

    // Re-attach editor toggle listener
    document.getElementById('editorToggle').addEventListener('click', () => {
        document.getElementById('editorPanel').classList.toggle('active');
    });
}

document.addEventListener('DOMContentLoaded', initApp);
