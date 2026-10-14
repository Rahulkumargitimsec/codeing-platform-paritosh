import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(() => {});

const ICONS = { ok: CheckCircle2, bad: AlertCircle, info: Info };
const COLORS = { ok: 'text-ok', bad: 'text-bad', info: 'text-accent' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);

  const dismiss = useCallback((tid) => setToasts((t) => t.filter((x) => x.id !== tid)), []);

  const toast = useCallback((message, tone = 'ok', ms = 4200) => {
    const tid = ++id.current;
    setToasts((t) => [...t.slice(-3), { id: tid, message, tone }]);
    setTimeout(() => dismiss(tid), ms);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 items-end pointer-events-none" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.tone] || Info;
          return (
            <div key={t.id} className="pop-in pointer-events-auto panel panel-raised flex items-start gap-3 px-4 py-3 w-full sm:w-96">
              <Icon size={18} className={`${COLORS[t.tone] || 'text-accent'} mt-0.5 shrink-0`} />
              <p className="text-sm flex-1 whitespace-pre-line">{t.message}</p>
              <button className="text-ink-3 hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
