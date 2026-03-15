import { db, ref, set, push, onValue, update, remove, get } from './firebase-config.js';
import { showSuccess, showError, confirmAction, formatCurrency } from './utils.js';

let productsData = [];

export const initInventory = () => {
    // DOM Elements
    const form = document.getElementById('product-form');
    const searchInput = document.getElementById('search-inventory');
    const categoryFilter = document.getElementById('filter-category');
    
    // Listen to Products Changes in Firebase
    const productsRef = ref(db, 'products');
    onValue(productsRef, (snapshot) => {
        productsData = [];
        snapshot.forEach(child => {
            productsData.push({ id: child.key, ...child.val() });
        });
        renderProducts(productsData);
    });

    // Form Submit
    form.addEventListener('submit', handleProductSubmit);

    // Search and Filter
    searchInput.addEventListener('input', applyFilters);
    categoryFilter.addEventListener('change', applyFilters);
};

const renderProducts = (products) => {
    const container = document.getElementById('products-container');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<div class="loading-state">لا توجد منتجات مسجلة</div>';
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        const imageHtml = product.image 
            ? `<img src="${product.image}" class="product-image" alt="صورة المنتج">`
            : `<div class="product-image-placeholder"><i class="fa-solid fa-image"></i></div>`;

        card.innerHTML = `
            ${imageHtml}
            <div class="product-details">
                <div class="product-title" title="${product.name}">${product.name}</div>
                <div class="product-meta">
                    <span><i class="fa-solid fa-tag"></i> ${product.category}</span>
                    <span>كود: ${product.code}</span>
                </div>
                ${product.color ? `<div class="text-muted"><small>اللون: ${product.color}</small></div>` : ''}
                <div class="product-price-row">
                    <div class="price-block">
                        <small>تكلفة</small>
                        <strong>${formatCurrency(product.costPrice)}</strong>
                    </div>
                    <div class="price-block text-left">
                        <small>بيع</small>
                        <strong>${formatCurrency(product.sellPrice)}</strong>
                    </div>
                </div>
            </div>
            <div class="product-actions">
                <div class="qty-controls" style="border: none; background: transparent;">
                    <button class="btn btn-sm btn-outline text-danger" title="حذف المنتج" onclick="window.inventoryModule.deleteProduct('${product.id}')">
                        <i class="fa-solid fa-trash-can"></i> حذف
                    </button>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="window.inventoryModule.updateQty('${product.id}', -1)"><i class="fa-solid fa-minus"></i></button>
                    <span class="qty-display ${product.quantity <= 0 ? 'text-danger' : ''}">${product.quantity}</span>
                    <button class="qty-btn" onclick="window.inventoryModule.updateQty('${product.id}', 1)"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
};

const applyFilters = () => {
    const search = document.getElementById('search-inventory').value.toLowerCase();
    const category = document.getElementById('filter-category').value;

    const filtered = productsData.filter(p => {
        const matchSearch = String(p.name).toLowerCase().includes(search) || String(p.code).toLowerCase().includes(search);
        const matchCategory = category === 'all' || p.category === category;
        return matchSearch && matchCategory;
    });

    renderProducts(filtered);
};

const handleProductSubmit = async (e) => {
    e.preventDefault();

    const name = document.getElementById('prod-name').value;
    const code = document.getElementById('prod-code').value;
    const category = document.getElementById('prod-category').value;
    const color = document.getElementById('prod-color').value;
    const quantity = parseInt(document.getElementById('prod-qty').value);
    const image = document.getElementById('prod-image').value;
    const costPrice = parseFloat(document.getElementById('prod-cost').value);
    const sellPrice = parseFloat(document.getElementById('prod-price').value);

    // Validate Code Dup
    const isDup = productsData.some(p => p.code === code);
    if (isDup) {
        showError('خطأ', 'رقم الكود موجود مسبقاً لمنتج آخر!');
        return;
    }

    try {
        const newProductRef = push(ref(db, 'products'));
        await set(newProductRef, {
            name, code, category, color, quantity, image, costPrice, sellPrice,
            createdAt: Date.now()
        });

        // Reset and close
        e.target.reset();
        closeModal();
        showSuccess('تم بنجاح', 'تمت إضافة المنتج للمخزون');
    } catch (error) {
        console.error(error);
        showError('خطأ', 'حدث خطأ أثناء حفظ المنتج المطابق للبيانات.');
    }
};

export const updateQty = async (id, change) => {
    const product = productsData.find(p => p.id === id);
    if (!product) return;

    let newQty = product.quantity + change;
    if (newQty < 0) {
        showError('تنبيه', 'لا يمكن أن تكون الكمية أقل من صفر');
        return;
    }

    try {
        await update(ref(db, `products/${id}`), { quantity: newQty });
    } catch (e) {
        console.error(e);
        showError('خطأ', 'حدث خطأ أثناء تحديث الكمية');
    }
};

export const deleteProduct = async (id) => {
    const confirmed = await confirmAction('حذف منتج', 'هل أنت متأكد من حذف هذا المنتج نهائياً من قاعدة البيانات؟');
    if (confirmed) {
        try {
            await remove(ref(db, `products/${id}`));
            showSuccess('تم الحذف', 'تم حذف المنتج نهائياً');
        } catch (e) {
            console.error(e);
            showError('خطأ', 'حدث خطأ أثناء الحذف');
        }
    }
};

export const openAddModal = () => {
    document.getElementById('product-form').reset();
    document.getElementById('product-modal').classList.remove('d-none');
};

export const closeModal = () => {
    document.getElementById('product-modal').classList.add('d-none');
};

// Expose functions globally for HTML inline handlers
window.inventoryModule = {
    openAddModal,
    closeModal,
    updateQty,
    deleteProduct
};
