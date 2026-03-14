import { db, ref, onValue, update, get } from './firebase-config.js';
import { formatCurrency, formatDate, showSuccess, confirmAction, showError } from './utils.js';

let ordersData = [];

export const initOrderStatus = () => {
    const searchInput = document.getElementById('search-orders');
    const filterSelect = document.getElementById('filter-order-status');

    // Listen to Orders
    const ordersRef = ref(db, 'orders');
    onValue(ordersRef, (snapshot) => {
        ordersData = [];
        snapshot.forEach(child => {
            ordersData.push({ id: child.key, ...child.val() });
        });
        // Sort by newest first
        ordersData.sort((a, b) => b.createdAt - a.createdAt);
        applyOrderFilters();
    });

    searchInput.addEventListener('input', applyOrderFilters);
    filterSelect.addEventListener('change', applyOrderFilters);
};

const applyOrderFilters = () => {
    const search = document.getElementById('search-orders').value.toLowerCase();
    const filter = document.getElementById('filter-order-status').value;

    const filtered = ordersData.filter(o => {
        const matchSearch = String(o.displayId).toLowerCase().includes(search) || 
                            String(o.customerPhone).includes(search) ||
                            String(o.customerName).toLowerCase().includes(search);
        
        const matchFilter = filter === 'all' || o.status === filter;
        
        return matchSearch && matchFilter;
    });

    renderOrdersTable(filtered);
};

const renderOrdersTable = (orders) => {
    const tbody = document.getElementById('orders-table-body');
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا توجد طلبيات مطابقة للبحث</td></tr>';
        return;
    }

    orders.forEach(order => {
        const tr = document.createElement('tr');
        
        let statusClass = 'bg-secondary';
        switch (order.status) {
            case 'جديد': statusClass = 'status-new'; break;
            case 'قيد المراجعة': statusClass = 'status-review'; break;
            case 'تم التسليم': statusClass = 'status-delivered'; break;
            case 'راجع': statusClass = 'status-returned'; break;
        }

        // Action buttons logic based on rules
        let actionsHtml = `<button class="btn btn-sm btn-outline text-primary ml-1" onclick="window.orderStatusModule.viewOrderDetails('${order.id}')" title="عرض التفاصيل"><i class="fa-solid fa-eye"></i></button>`;
        
        if (order.status !== 'تم التسليم' && order.status !== 'راجع') {
            actionsHtml += `
                <button class="btn btn-sm btn-success mr-1" onclick="window.orderStatusModule.changeStatus('${order.id}', 'تم التسليم')" title="تسليم"><i class="fa-solid fa-check"></i></button>
                <button class="btn btn-sm btn-danger mx-1" onclick="window.orderStatusModule.changeStatus('${order.id}', 'راجع')" title="إرجاع"><i class="fa-solid fa-rotate-left"></i></button>
            `;
        } else if (order.status === 'تم التسليم') {
            // Allows returning a delivered order (deducts cash, returns items)
            actionsHtml += `
                <button class="btn btn-sm btn-danger mx-1" onclick="window.orderStatusModule.changeStatus('${order.id}', 'راجع')" title="إرجاع بعد التسليم"><i class="fa-solid fa-rotate-left"></i></button>
            `;
        }

        tr.innerHTML = `
            <td data-label="رقم الطلبية"># ${order.displayId || order.id.slice('-6')}</td>
            <td data-label="الزبون"><strong>${order.customerName}</strong></td>
            <td data-label="الهاتف" dir="ltr" class="text-right">${order.customerPhone}</td>
            <td data-label="الإجمالي" class="text-success font-weight-bold">${formatCurrency(order.totalAmount)}</td>
            <td data-label="الحالة"><span class="status-badge ${statusClass}">${order.status}</span></td>
            <td data-label="التاريخ">${formatDate(order.createdAt)}</td>
            <td data-label="الإجراءات" style="white-space: nowrap;">${actionsHtml}</td>
        `;

        tbody.appendChild(tr);
    });
};

const viewOrderDetails = (id) => {
    const order = ordersData.find(o => o.id === id);
    if (!order) return;

    document.getElementById('view-order-id').textContent = order.displayId || order.id.slice(-6);
    
    let itemsHtml = '<ul class="list-group mt-3" style="list-style:none; padding:0;">';
    if(order.items) {
        Object.values(order.items).forEach(item => {
            itemsHtml += `
                <li style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;">
                    <div>
                        <strong>${item.name}</strong> <small class="text-muted">(${item.color || 'بدون لون'})</small><br>
                        الكمية: ${item.quantity} x ${formatCurrency(item.sellPrice)}
                    </div>
                    <div class="text-left font-weight-bold text-primary">
                        ${formatCurrency(item.quantity * item.sellPrice)}
                    </div>
                </li>
            `;
        });
    }
    itemsHtml += '</ul>';

    const content = `
        <div class="row" style="display:flex; gap:20px; flex-wrap:wrap;">
            <div style="flex:1; min-width: 200px;">
                <p><strong>الزبون:</strong> ${order.customerName}</p>
                <p><strong>الهاتف:</strong> <span dir="ltr">${order.customerPhone}</span></p>
                <p><strong>العنوان:</strong> ${order.customerAddress}</p>
            </div>
            <div style="flex:1; min-width: 200px; text-align: left;">
                <p><strong>حالة الطلبية:</strong> ${order.status}</p>
                <p><strong>تاريخ الطلب:</strong> ${formatDate(order.createdAt)}</p>
            </div>
        </div>
        <hr>
        <h4>المنتجات المطلوبة</h4>
        ${itemsHtml}
        <div style="background:var(--bg-main); padding: 15px; border-radius: 8px; margin-top:20px;">
            <div style="display:flex; justify-content: space-between; font-size: 1.1rem; margin-bottom: 10px;">
                <span>إجمالي الطلبية:</span>
                <strong class="text-success">${formatCurrency(order.totalAmount)}</strong>
            </div>
            <div style="display:flex; justify-content: space-between; font-size: 1.1rem;">
                <span>إجمالي المكسب:</span>
                <strong class="text-primary">${formatCurrency(order.totalProfit)}</strong>
            </div>
        </div>
    `;

    document.getElementById('view-order-details-content').innerHTML = content;
    document.getElementById('order-view-modal').classList.remove('d-none');
};

const changeStatus = async (orderId, newStatus) => {
    const order = ordersData.find(o => o.id === orderId);
    if (!order) return;

    let confirmMsg = `هل أنت متأكد من تغيير حالة الطلبية إلى "${newStatus}"؟\n`;
    
    if (newStatus === 'تم التسليم') {
        confirmMsg += "\nسيتم إضافة قيمة الطلبية للإيرادات والمكاسب مباشرةً.";
    } else if (newStatus === 'راجع' && order.status === 'تم التسليم') {
        confirmMsg += "\nتنبيه: سيتم خصم مكسب وقيمة الطلبية من الإيرادات، وسيتم إعادة المنتجات إلى المخزون.";
    } else if (newStatus === 'راجع') {
        confirmMsg += "\nسيتم إعادة الكميات المختارة إلى المخزون وعدم احتسابها في الإيرادات.";
    }

    const confirmed = await confirmAction('تأكيد الحالة', confirmMsg, newStatus === 'راجع' ? '#e74c3c' : '#2ecc71');
    if (!confirmed) return;

    try {
        // Logic for "Returned"
        if (newStatus === 'راجع') {
            // Return items to stock based on order details!
            if (order.items) {
                for (const itemId of Object.keys(order.items)) {
                    const itemData = order.items[itemId];
                    const prodRef = ref(db, `products/${itemData.productId}`);
                    const snap = await get(prodRef);
                    if (snap.exists()) {
                        const currentStock = snap.val().quantity || 0;
                        await update(prodRef, {
                            quantity: currentStock + itemData.quantity
                        });
                    } else {
                         // If product was deleted, recreate it minimally or ignore?
                         // Recreating to keep inventory trace:
                         await update(prodRef, {
                             name: itemData.name,
                             code: itemData.code,
                             quantity: itemData.quantity,
                             sellPrice: itemData.sellPrice,
                             costPrice: itemData.costPrice,
                             category: 'مرتجع'
                         });
                    }
                }
            }
        }

        // The Finance calculation handles delivered orders directly dynamically via dashboard.js & finance.js reading 'orders' status!
        // So simply updating the status string is enough.

        await update(ref(db, `orders/${orderId}`), {
            status: newStatus,
            updatedAt: Date.now()
        });

        showSuccess('تم التحديث', 'تم تغيير حالة الطلبية وتحديث المخزون بنجاح.');

    } catch (e) {
        console.error('Error updating status', e);
        showError('خطأ', 'حدث خطأ أثناء تغيير الحالة وتحديث قواعد البيانات.');
    }
};

window.orderStatusModule = { changeStatus, viewOrderDetails };
