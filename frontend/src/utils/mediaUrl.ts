export const resolveMediaUrl = (url?: string | null) => {
  if (!url) return '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (url.startsWith('/uploads/')) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    const backendBase = apiBase ? apiBase.replace(/\/api\/v1\/?$/, '') : 'http://localhost:4001';
    return `${backendBase}${url}`;
  }

  return url;
};
