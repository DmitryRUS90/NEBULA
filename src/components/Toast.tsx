import { Info, WarningCircle } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useStore } from '../core/store';

/** One calm, specific message at a time. Clears itself. */
export function Toast() {
  const toast = useStore((s) => s.toast);
  const clear = useStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(clear, 5200);
    return () => window.clearTimeout(id);
  }, [toast, clear]);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className={`toast toast-${toast.tone} body-5`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {toast.tone === 'warn' ? <WarningCircle size={18} weight="bold" /> : <Info size={18} weight="bold" />}
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
