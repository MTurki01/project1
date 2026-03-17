import { db, ref, get, set, push } from './firebase-config.js';
import { showSuccess, showError } from './utils.js';

export const initExcelImport = () => {
    const fileInput = document.getElementById('excelFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleExcelUpload);
    }
};

const triggerFileInput = () => {
    document.getElementById('excelFileInput').click();
};

const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input so the same file could be selected again if needed
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length <= 1) {
                showError('ملف فارغ', 'الملف لا يحتوي على بيانات أو يحتوي على عناوين فقط!');
                return;
            }

            await processExcelData(jsonData);

        } catch (error) {
            console.error('Error parsing Excel:', error);
            showError('خطأ في القراءة', 'حدث خطأ أثناء قراءة ملف الإكسل. تأكد من صيغة الملف.');
        }
    };
    reader.readAsArrayBuffer(file);
};

const processExcelData = async (rows) => {
    // Expected Columns Exact Order:
    // 0: اسم المنتج
    // 1: العدد
    // 2: النوع / القسم
    // 3: اللون
    // 4: الكود
    // 5: رابط صورة المنتج
    // 6: التكلفة
    // 7: سعر البيع

    // Skip the first row (headers)
    const dataRows = rows.slice(1);
    
    // Fetch existing codes to prevent duplicate logic
    const productsRef = ref(db, 'products');
    let existingCodes = [];
    try {
        const snapshot = await get(productsRef);
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                existingCodes.push(child.val().code);
            });
        }
    } catch (e) {
        console.error("Error fetching existing products for validation", e);
    }

    let successCount = 0;
    let failedCount = 0;
    let skippedCodes = 0;

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        
        // Skip empty rows completely
        if (!row || row.length === 0 || !row[0]) {
            failedCount++;
            continue;
        }

        const name = row[0] ? String(row[0]).trim() : '';
        const qtyRaw = parseInt(row[1]);
        const quantity = isNaN(qtyRaw) ? 0 : qtyRaw;
        const category = row[2] ? String(row[2]).trim() : 'أخرى';
        const color = row[3] ? String(row[3]).trim() : '';
        const code = row[4] ? String(row[4]).trim() : `AUTO-${Date.now()}-${i}`;
        const image = row[5] ? String(row[5]).trim() : '';
        const costRaw = parseFloat(row[6]);
        const costPrice = isNaN(costRaw) ? 0 : costRaw;
        const sellRaw = parseFloat(row[7]);
        const sellPrice = isNaN(sellRaw) ? 0 : sellRaw;

        // Validation based on requirements
        if (!name || isNaN(costPrice) || isNaN(sellPrice)) {
            failedCount++;
            continue;
        }

        try {
            const newProductRef = push(productsRef);
            await set(newProductRef, {
                name,
                quantity: quantity < 0 ? 0 : quantity,
                category,
                color,
                code,
                image,
                costPrice,
                sellPrice,
                createdAt: Date.now()
            });
            successCount++;
        } catch (err) {
            console.error(err);
            failedCount++;
        }
    }

    let msg = `تم استيراد ${successCount} منتج بنجاح.`;
    if (failedCount > 0) msg += `\nيوجد ${failedCount} صف غير صالح أو تالف.`;

    if (successCount > 0) {
        showSuccess('عملية الاستيراد اكتملت', msg);
    } else {
        showError('نتيجة الاستيراد', msg);
    }
};

window.excelModule = { triggerFileInput };
