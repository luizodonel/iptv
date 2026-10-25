// Client branding & whitelabel service

let currentBranding = {
  isCustomBrand: false,
  brandName: 'Top Canais',
  brandBadge: 'TV',
  resellerId: null,
  resellerSlug: null,
  contactPhone: null,
  supportPhoneDisplay: '(61) 98226-1155'
};

export function getBranding() {
  return currentBranding;
}

export async function fetchBranding(customHost = null) {
  try {
    const host = customHost || (typeof window !== 'undefined' ? window.location.hostname : '');
    const url = `/api/public/branding?originHost=${encodeURIComponent(host)}&host=${encodeURIComponent(host)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      currentBranding = {
        isCustomBrand: Boolean(data.isCustomBrand),
        brandName: data.brandName || 'Top Canais',
        brandBadge: data.brandBadge || 'TV',
        resellerId: data.resellerId || null,
        resellerSlug: data.resellerSlug || null,
        contactPhone: data.contactPhone || null,
        supportPhoneDisplay: data.supportPhoneDisplay || '(61) 98226-1155'
      };

      if (typeof document !== 'undefined') {
        document.title = `${currentBranding.brandName} — Filmes, Séries e TV Online`;
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cinestream_branding_updated', { detail: currentBranding }));
      }

      return currentBranding;
    }
  } catch (err) {
    console.warn('Erro ao carregar branding:', err);
  }
  return currentBranding;
}
