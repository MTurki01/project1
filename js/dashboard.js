import { db, ref, onValue } from './firebase-config.js';
import { formatCurrency } from './utils.js';

let profitChartInstance = null;

// Initialize Dashboard
export const initDashboard = () => {
    // Listen to Orders for Stats
    const ordersRef = ref(db, 'orders');
    onValue(ordersRef, (snapshot) => {
        const orders = [];
        snapshot.forEach(child => {
            orders.push({ id: child.key, ...child.val() });
        });
        updateDashboardMetrics(orders);
        updateWeeklyChart(orders);
        updateTopProducts(orders);
    });
};

const updateDashboardMetrics = (orders) => {
    let deliveredCount = 0;
    let returnedCount = 0;
    let totalRevenue = 0;
    let totalProfit = 0;

    orders.forEach(order => {
        if (order.status === 'تم التسليم') {
            deliveredCount++;
            totalRevenue += Number(order.totalAmount || 0);
            totalProfit += Number(order.totalProfit || 0);
        } else if (order.status === 'راجع') {
            returnedCount++;
        }
    });

    document.getElementById('dash-delivered-count').textContent = deliveredCount;
    document.getElementById('dash-returned-count').textContent = returnedCount;
    document.getElementById('dash-total-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('dash-total-profit').textContent = formatCurrency(totalProfit);
};

const updateWeeklyChart = (orders) => {
    // Group profits by week (delivered orders only)
    const weeklyProfits = {}; // key: "Year-WeekNum", value: profit
    
    orders.forEach(order => {
        if (order.status === 'تم التسليم' && order.createdAt) {
            const date = new Date(order.createdAt);
            const year = date.getFullYear();
            // Get week number (1-52)
            const firstDayOfYear = new Date(year, 0, 1);
            const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
            const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            
            const weekKey = `أسبوع ${weekNum} - ${year}`;
            
            if (!weeklyProfits[weekKey]) {
                weeklyProfits[weekKey] = 0;
            }
            weeklyProfits[weekKey] += Number(order.totalProfit || 0);
        }
    });

    // Sort keys logically (simplified sort by string for now since format is week - year)
    // For proper sorting it's better to sort by actual date, but let's keep it simple
    const sortedLabels = Object.keys(weeklyProfits).sort((a,b) => {
        // extract year and week
        const matchA = a.match(/أسبوع (\d+) - (\d+)/);
        const matchB = b.match(/أسبوع (\d+) - (\d+)/);
        if(matchA && matchB) {
            if(matchA[2] !== matchB[2]) return parseInt(matchA[2]) - parseInt(matchB[2]);
            return parseInt(matchA[1]) - parseInt(matchB[1]);
        }
        return 0;
    });

    const data = sortedLabels.map(label => weeklyProfits[label]);

    renderChart(sortedLabels, data);
};

const renderChart = (labels, data) => {
    const ctx = document.getElementById('profitChart');
    if (!ctx) return;

    if (profitChartInstance) {
        profitChartInstance.destroy();
    }

    profitChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['لا توجد بيانات'],
            datasets: [{
                label: 'المكسب (د.ل)',
                data: data.length > 0 ? data : [0],
                backgroundColor: 'rgba(67, 97, 238, 0.7)',
                borderColor: 'rgba(67, 97, 238, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
};

const updateTopProducts = (orders) => {
    // Analyze all items in all DELIVERED orders
    const productStats = {}; // productId: { name, totalProfit, totalQty }

    orders.forEach(order => {
        if (order.status === 'تم التسليم' && order.items) {
            Object.values(order.items).forEach(item => {
                if (!productStats[item.productId]) {
                    productStats[item.productId] = {
                        name: item.name,
                        totalProfit: 0,
                        totalQty: 0
                    };
                }
                productStats[item.productId].totalProfit += Number(item.profit || 0);
                productStats[item.productId].totalQty += Number(item.quantity || 0);
            });
        }
    });

    let bestProfitId = null;
    let maxProfit = -1;

    let bestReqId = null;
    let maxReq = -1;

    for (const [id, stats] of Object.entries(productStats)) {
        if (stats.totalProfit > maxProfit) {
            maxProfit = stats.totalProfit;
            bestProfitId = id;
        }
        if (stats.totalQty > maxReq) {
            maxReq = stats.totalQty;
            bestReqId = id;
        }
    }

    const eleProfit = document.getElementById('best-profit-product');
    const eleReq = document.getElementById('most-requested-product');

    if (bestProfitId) {
        eleProfit.textContent = `${productStats[bestProfitId].name} (${formatCurrency(maxProfit)})`;
    } else {
        eleProfit.textContent = 'لا توجد بيانات كافية';
    }

    if (bestReqId) {
        eleReq.textContent = `${productStats[bestReqId].name} (${productStats[bestReqId].totalQty} قطعة)`;
    } else {
        eleReq.textContent = 'لا توجد بيانات كافية';
    }
};
