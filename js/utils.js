export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-LY', { style: 'currency', currency: 'LYD' }).format(amount);
};

export const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('ar-LY', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

export const showSuccess = (title, text = '') => {
    Swal.fire({
        icon: 'success',
        title: title,
        text: text,
        confirmButtonColor: '#4361ee',
        confirmButtonText: 'حسناً'
    });
};

export const showError = (title, text = '') => {
    Swal.fire({
        icon: 'error',
        title: title,
        text: text,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: 'حسناً'
    });
};

export const confirmAction = async (title, text = '', confirmColor = '#e74c3c') => {
    const result = await Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: confirmColor,
        cancelButtonColor: '#8d99ae',
        confirmButtonText: 'نعم، متأكد',
        cancelButtonText: 'إلغاء'
    });
    return result.isConfirmed;
};
