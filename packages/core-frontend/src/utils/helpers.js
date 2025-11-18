export const formatCurrency = (value, currency = 'CZK') => {
  if (value == null || Number.isNaN(Number(value))) {
    return '-';
  }

  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
};

export const formatNumber = (value, options = {}) => {
  if (value == null || Number.isNaN(Number(value))) {
    return '-';
  }

  return new Intl.NumberFormat('cs-CZ', {
    maximumFractionDigits: 2,
    ...options,
  }).format(Number(value));
};

export const formatDate = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleString('cs-CZ');
};

export const formatFileSize = (bytes) => {
  const size = Number(bytes);
  if (size === 0) return '0 Bytes';
  if (!size || Number.isNaN(size)) return '';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(size) / Math.log(k)), sizes.length - 1);
  const value = size / Math.pow(k, i);
  return `${Math.round(value * 100) / 100} ${sizes[i]}`;
};

export const truncateText = (text, length = 50) => {
  if (!text) return '';
  return text.length > length ? `${text.substring(0, length)}...` : text;
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
