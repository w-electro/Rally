import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerStore } from '@/stores/serverStore';
import api from '@/lib/api';
import type { Product } from '@/lib/types';
import { ShoppingBag, Plus, Tag, DollarSign, Package, Crown, Smile } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { Modal } from '../ui/Modal';

const PRODUCT_TYPES = [
  { id: 'ALL', labelKey: 'commerce.all', icon: Package },
  { id: 'DIGITAL_DOWNLOAD', labelKey: 'commerce.digital', icon: Package },
  { id: 'ROLE', labelKey: 'commerce.ranks', icon: Crown },
  { id: 'CUSTOM_EMOJI', labelKey: 'commerce.emojis', icon: Smile },
  { id: 'SUBSCRIPTION', labelKey: 'commerce.subs', icon: Tag },
];

export function CommerceView() {
  const { t } = useTranslation();
  const { activeServer } = useServerStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeServer) return;
    setIsLoading(true);
    api.getProducts(activeServer.id)
      .then(setProducts)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [activeServer?.id]);

  const filtered = filter === 'ALL' ? products : products.filter((p) => p.type === filter);

  const handlePurchase = async (product: Product) => {
    try {
      await api.purchaseProduct(product.id);
      setSelectedProduct(null);
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col bg-black min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-rally-border bg-[#0D1117]/80 flex items-center gap-3">
        <ShoppingBag className="w-5 h-5 text-rally-green" />
        <h2 className="font-display font-bold text-rally-text">{t('commerce.serverShop')}</h2>
        <div className="flex-1" />
        <button className="btn-rally text-xs flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" />{t('commerce.listProduct')}
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-rally-border flex gap-2 overflow-x-auto">
        {PRODUCT_TYPES.map((pt) => (
          <button
            key={pt.id}
            onClick={() => setFilter(pt.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap',
              filter === pt.id ? 'bg-rally-green/10 text-rally-green border border-rally-green/30' : 'bg-white/5 text-rally-text-muted hover:bg-white/10'
            )}
          >
            <pt.icon className="w-3.5 h-3.5" />{t(pt.labelKey)}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center py-12"><div className="w-6 h-6 border-2 border-rally-green border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-12 h-12 text-rally-text-muted mx-auto mb-3" />
            <p className="text-rally-text-muted">{t('commerce.noProducts')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((product) => (
              <button key={product.id} onClick={() => setSelectedProduct(product)} className="card-rally rounded-lg p-3 text-left hover:border-rally-green/30 transition-all">
                <div className="aspect-square bg-rally-navy rounded mb-2 flex items-center justify-center">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover rounded" />
                  ) : (
                    <Package className="w-8 h-8 text-rally-text-muted" />
                  )}
                </div>
                <h4 className="text-sm font-semibold text-rally-text truncate">{product.title}</h4>
                <p className="text-xs text-rally-text-muted truncate">{product.description || t('commerce.noDescription')}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-display font-bold text-rally-green">
                    ${(product.price / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-rally-text-muted uppercase">{product.type.replace('_', ' ')}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <Modal isOpen onClose={() => setSelectedProduct(null)} title={selectedProduct.title} size="md">
          <div className="space-y-4">
            <div className="aspect-video bg-rally-navy rounded-lg flex items-center justify-center">
              {selectedProduct.imageUrl ? (
                <img src={selectedProduct.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <Package className="w-16 h-16 text-rally-text-muted" />
              )}
            </div>
            <p className="text-sm text-rally-text-muted">{selectedProduct.description || t('commerce.noDescription')}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-rally-text-muted">{t('commerce.price')}</p>
                <p className="text-2xl font-display font-bold text-rally-green">${(selectedProduct.price / 100).toFixed(2)} <span className="text-xs text-rally-text-muted">{selectedProduct.currency}</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-rally-text-muted">{t('commerce.seller')}</p>
                <p className="text-sm text-rally-text">{selectedProduct.seller?.displayName}</p>
              </div>
            </div>
            <button onClick={() => handlePurchase(selectedProduct)} className="btn-rally-primary w-full py-3">
              <DollarSign className="w-4 h-4 inline mr-1" />{t('commerce.purchase')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
