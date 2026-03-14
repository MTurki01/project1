import { db, ref, onValue, push, set, get, update } from './firebase-config.js';
import { showSuccess, showError, formatCurrency } from './utils.js';

let availableProducts = [];
let cart = {}; // productId: { ...productData, orderQty }

export const initOrders = () => {
    const searchInput = document.getElementById('search-order-products');
    const saveBtn = document.getElementById('save-order-btn');

    // Fetch Products for the Order list
    const productsRef = ref(db, 'products');
    onValue(productsRef, (snapshot) => {
        availableProducts = [];
        snapshot.forEach(child => {
            const val = child.val();
            if (val.quantity > 0) { // Only show items in stock
                availableProducts.push({ id: child.key, ...val });
            }
        });
        renderOrderProducts(availableProducts);
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = availableProducts.filter(p => 
            String(p.name).toLowerCase().includes(searchTerm) || 
            String(p.code).toLowerCase().includes(searchTerm)
        );
        renderOrderProducts(filtered);
    });

    saveBtn.addEventListener('click', handleSaveOrder);
};

const renderOrderProducts = (products) => {
    const container = document.getElementById('order-products-list');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<p class="text-muted text-center w-100 mt-3">لا توجد منتجات متوفرة</p>';
        return;
    }

    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'order-item-card';
        div.innerHTML = `
            <strong>${product.name}</strong>
            <div class="text-muted small">${product.code}</div>
            <div class="text-primary mt-1">${formatCurrency(product.sellPrice)}</div>
            <div class="text-success small">متاح: ${product.quantity}</div>
        `;
        div.onclick = () => addToCart(product);
        container.appendChild(div);
    });
};

const addToCart = (product) => {
    if (cart[product.id]) {
        if (cart[product.id].orderQty < product.quantity) {
            cart[product.id].orderQty++;
        } else {
            showError('تنبيه', 'لا يمكن تجاوز الكمية المتاحة في المخزون!');
            return;
        }
    } else {
        cart[product.id] = { ...product, orderQty: 1 };
    }
    renderCart();
};

const updateCartQty = (id, newQty) => {
    if (!cart[id]) return;
    
    // Find absolute max stock from our internal array
    const stockP = availableProducts.find(p => p.id === id);
    const maxStock = stockP ? stockP.quantity : 0;

    const qty = parseInt(newQty);
    if (isNaN(qty) || qty <= 0) {
        delete cart[id];
    } else if (qty > maxStock) {
        showError('تنبيه', `أقصى كمية متاحة هي ${maxStock}`);
        cart[id].orderQty = maxStock;
    } else {
        cart[id].orderQty = qty;
    }
    renderCart();
};

const removeFromCart = (id) => {
    delete cart[id];
    renderCart();
};

window.orderModule = { updateCartQty, removeFromCart };

const renderCart = () => {
    const container = document.getElementById('selected-order-items');
    const msg = document.getElementById('empty-cart-msg');
    
    const cartItems = Object.values(cart);
    
    if (cartItems.length === 0) {
        container.innerHTML = '';
        if(msg) msg.style.display = 'block';
        updateTotals();
        return;
    }

    if(msg) msg.style.display = 'none';
    container.innerHTML = '';

    cartItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'selected-order-item';
        div.innerHTML = `
            <div class="item-info">
                <h5>${item.name}</h5>
                <small class="text-muted">${formatCurrency(item.sellPrice)}</small>
            </div>
            <div class="d-flex align-items-center gap-2">
                <input type="number" class="order-qty-input" value="${item.orderQty}" 
                       min="1" max="${item.quantity}"
                       onchange="window.orderModule.updateCartQty('${item.id}', this.value)">
                <button class="btn btn-sm btn-danger px-2 py-1" onclick="window.orderModule.removeFromCart('${item.id}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });

    updateTotals();
};

const updateTotals = () => {
    let totalPrice = 0;
    let totalProfit = 0;

    Object.values(cart).forEach(item => {
        const itemTotal = item.sellPrice * item.orderQty;
        const itemCost = item.costPrice * item.orderQty;
        const profit = itemTotal - itemCost;
        
        totalPrice += itemTotal;
        totalProfit += profit;
    });

    document.getElementById('order-total-price').textContent = formatCurrency(totalPrice);
    document.getElementById('order-total-profit').textContent = formatCurrency(totalProfit);

    // attach raw data for easy access during save
    document.getElementById('save-order-btn').dataset.totalPrice = totalPrice;
    document.getElementById('save-order-btn').dataset.totalProfit = totalProfit;
};

const handleSaveOrder = async () => {
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const address = document.getElementById('customer-address').value.trim();
    const tPrice = parseFloat(document.getElementById('save-order-btn').dataset.totalPrice || 0);
    const tProfit = parseFloat(document.getElementById('save-order-btn').dataset.totalProfit || 0);

    const cartItems = Object.values(cart);

    if (cartItems.length === 0) {
        showError('بيانات ناقصة', 'يجب اختيار منتج واحد على الأقل.');
        return;
    }

    if (!name || !phone || !address) {
        showError('بيانات ناقصة', 'يرجى إدخال جميع بيانات الزبون (الاسم، الهاتف، العنوان).');
        return;
    }

    // Prepare items object for Firebase
    const itemsForDb = {};
    cartItems.forEach(item => {
        const profitPerItem = (item.sellPrice - item.costPrice) * item.orderQty;
        itemsForDb[item.id] = {
            productId: item.id,
            name: item.name,
            code: item.code,
            color: item.color || '',
            quantity: item.orderQty,
            sellPrice: item.sellPrice,
            costPrice: item.costPrice,
            profit: profitPerItem
        };
    });

    try {
        // Generate Order ID (Auto-increment logic or push key)
        const newOrderRef = push(ref(db, 'orders'));
        const orderId = `ORD-${Date.now().toString().slice(-6)}`; // simple readable format
        
        // 1. Double check and deduct inventory quantities safely
        for (const item of cartItems) {
             const prodRef = ref(db, `products/${item.id}`);
             const snapshot = await get(prodRef);
             if (snapshot.exists()) {
                 const currentStock = snapshot.val().quantity;
                 if (currentStock < item.orderQty) {
                     showError('خطأ في المخزون', `الكمية المطلوبة من ${item.name} غير متوفرة حالياً.`);
                     return; // Abort entire order! (Critical for stock)
                 }
                 // Deduct stock
                 await update(prodRef, { quantity: currentStock - item.orderQty });
             } else {
                 showError('خطأ', `المنتج ${item.name} غير موجود في قاعدة البيانات`);
                 return;
             }
        }

        // 2. Save Order Record
        await set(newOrderRef, {
            displayId: orderId,
            customerName: name,
            customerPhone: phone,
            customerAddress: address,
            status: 'جديد', // default status
            totalAmount: tPrice,
            totalProfit: tProfit,
            createdAt: Date.now(),
            items: itemsForDb
        });

        // 3. Cleanup UI
        cart = {};
        renderCart();
        document.getElementById('customer-name').value = '';
        document.getElementById('customer-phone').value = '';
        document.getElementById('customer-address').value = '';
        
        showSuccess('تم الإنشاء', `تم إنشاء الطلبية بنجاح وانقاص الكمية من المخزون. رقم الطلبية: ${orderId}`);
        
        // redirect to order status view
        document.querySelector('[data-target="order-status"]').click();

    } catch (e) {
        console.error("Error creating order", e);
        showError('خطأ النظام', 'حدث خطأ غير متوقع أثناء حفظ الطلبية.');
    }
};
