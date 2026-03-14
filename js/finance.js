import { db, ref, onValue, push, set, remove } from './firebase-config.js';
import { formatCurrency, formatDate, showSuccess, showError, confirmAction } from './utils.js';

let expensesData = [];
let deliveredOrdersData = [];

export const initFinance = () => {
    // 1. Listen to Expenses
    const expRef = ref(db, 'expenses');
    onValue(expRef, (snapshot) => {
        expensesData = [];
        snapshot.forEach(child => {
            expensesData.push({ id: child.key, ...child.val() });
        });
        expensesData.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderExpenses();
        calculateFinance();
    });

    // 2. Listen to Orders for Income
    const ordersRef = ref(db, 'orders');
    onValue(ordersRef, (snapshot) => {
        deliveredOrdersData = [];
        snapshot.forEach(child => {
            const val = child.val();
            if (val.status === 'تم التسليم') {
                deliveredOrdersData.push(val);
            }
        });
        calculateFinance();
    });

    // Handle Form
    document.getElementById('expense-form').addEventListener('submit', handleExpenseSubmit);
};

const calculateFinance = () => {
    let totalIncome = 0;  // Sum of totalAmount of delivered orders
    let totalGrossProfit = 0; // Sum of totalProfit of delivered orders
    let totalExpenses = 0; // Sum of all expenses

    // Calculate from orders
    deliveredOrdersData.forEach(order => {
        totalIncome += Number(order.totalAmount || 0);
        totalGrossProfit += Number(order.totalProfit || 0);
    });

    // Calculate from expenses
    expensesData.forEach(exp => {
        totalExpenses += Number(exp.amount || 0);
    });

    const actualNetProfit = totalGrossProfit - totalExpenses;

    document.getElementById('finance-total-income').textContent = formatCurrency(totalIncome);
    
    const profitEl = document.getElementById('finance-actual-profit');
    profitEl.textContent = formatCurrency(actualNetProfit);
    
    if (actualNetProfit < 0) {
        profitEl.classList.remove('text-success');
        profitEl.classList.add('text-danger');
    } else {
        profitEl.classList.remove('text-danger');
        profitEl.classList.add('text-success');
    }
};

const renderExpenses = () => {
    const tbody = document.getElementById('expenses-table-body');
    tbody.innerHTML = '';

    if (expensesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد مصروفات مسجلة</td></tr>';
        return;
    }

    expensesData.forEach(exp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="الاسم">${exp.title}</td>
            <td data-label="القيمة" class="text-danger font-weight-bold">${formatCurrency(exp.amount)}</td>
            <td data-label="التاريخ">${exp.date}</td>
            <td data-label="ملاحظات">${exp.note || '-'}</td>
            <td data-label="إجراء">
                <button class="btn btn-sm btn-outline text-danger" onclick="window.financeModule.deleteExpense('${exp.id}')">
                    <i class="fa-solid fa-trash-can"></i> حذف
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    const title = document.getElementById('exp-title').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const date = document.getElementById('exp-date').value;
    const note = document.getElementById('exp-note').value;

    try {
        const newExpRef = push(ref(db, 'expenses'));
        await set(newExpRef, {
            title, amount, date, note,
            createdAt: Date.now()
        });

        e.target.reset();
        closeExpenseModal();
        showSuccess('تم بنجاح', 'تم تسجيل المصروف.');
    } catch (err) {
        console.error(err);
        showError('خطأ', 'حدث خطأ أثناء حفظ المصروف.');
    }
};

const deleteExpense = async (id) => {
    const confirmed = await confirmAction('حذف مصروف', 'هل أنت متأكد من حذف هذا السجل؟ سيؤثر ذلك على صافي الربح الفعلي.');
    if (confirmed) {
        try {
            await remove(ref(db, `expenses/${id}`));
            showSuccess('تم الحذف', 'تم حذف المصروف بنجاح.');
        } catch (e) {
            console.error(e);
            showError('خطأ', 'حدث خطأ أثناء الحذف.');
        }
    }
};

export const openExpenseModal = () => {
    document.getElementById('expense-form').reset();
    document.getElementById('exp-date').valueAsDate = new Date();
    document.getElementById('expense-modal').classList.remove('d-none');
};

export const closeExpenseModal = () => {
    document.getElementById('expense-modal').classList.add('d-none');
};

window.financeModule = { openExpenseModal, closeExpenseModal, deleteExpense };
