import { useEffect, useId, useRef, useState } from 'react';

const VARIANT_STYLES = {
  info: {
    border: 'border-cyan-500/40',
    glow: 'shadow-[0_0_40px_rgba(34,211,238,0.15)]',
    iconBg: 'bg-cyan-950 border-cyan-500 text-cyan-400',
    icon: 'fa-circle-info',
    primary: 'bg-cyan-500 hover:bg-cyan-400 text-black',
  },
  danger: {
    border: 'border-red-500/40',
    glow: 'shadow-[0_0_40px_rgba(239,68,68,0.2)]',
    iconBg: 'bg-red-950 border-red-500 text-red-400',
    icon: 'fa-triangle-exclamation',
    primary: 'bg-red-500 hover:bg-red-400 text-white',
  },
  success: {
    border: 'border-amber-500/40',
    glow: 'shadow-[0_0_40px_rgba(245,158,11,0.2)]',
    iconBg: 'bg-amber-950 border-amber-500 text-amber-400',
    icon: 'fa-circle-check',
    primary: 'bg-amber-500 hover:bg-amber-400 text-black',
  },
};

function buildInitialValues(dialog) {
  if (dialog.type === 'prompt') {
    return { value: dialog.defaultValue ?? '' };
  }
  if (dialog.type === 'form') {
    const values = {};
    (dialog.fields || []).forEach((field) => {
      values[field.name] = field.defaultValue ?? '';
    });
    return values;
  }
  return {};
}

export function AppDialog({ dialog, onClose }) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  const [values, setValues] = useState({});

  useEffect(() => {
    if (!dialog) return undefined;
    setValues(buildInitialValues(dialog));
    previouslyFocused.current = document.activeElement;

    const frame = requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) return;
      const focusTarget =
        root.querySelector('[data-autofocus]') ||
        root.querySelector('input, select, textarea, button');
      if (focusTarget) focusTarget.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (dialog.type === 'alert') onClose(true);
        else onClose(null);
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [dialog, onClose]);

  if (!dialog) return null;

  const variant = VARIANT_STYLES[dialog.variant] || VARIANT_STYLES.info;

  const submit = () => {
    if (dialog.type === 'alert') {
      onClose(true);
      return;
    }
    if (dialog.type === 'confirm') {
      onClose(true);
      return;
    }
    if (dialog.type === 'prompt') {
      onClose(values.value ?? '');
      return;
    }
    if (dialog.type === 'form') {
      onClose({ ...values });
    }
  };

  const cancel = () => {
    if (dialog.type === 'alert') onClose(true);
    else onClose(null);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={dialog.message ? descId : undefined}
        className={`bg-slate-900 border ${variant.border} ${variant.glow} p-6 md:p-8 rounded-3xl max-w-md w-full space-y-5`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center flex-shrink-0 ${variant.iconBg}`}
            aria-hidden="true"
          >
            <i className={`fa-solid ${variant.icon}`} />
          </div>
          <div className="min-w-0 space-y-1">
            <h3 id={titleId} className="font-orbitron font-black text-lg md:text-xl text-white uppercase">
              {dialog.title}
            </h3>
            {dialog.message ? (
              <p id={descId} className="text-sm text-slate-300 whitespace-pre-wrap">
                {dialog.message}
              </p>
            ) : null}
          </div>
        </div>

        {dialog.type === 'prompt' ? (
          <label className="block space-y-2">
            <span className="sr-only">{dialog.message || dialog.title}</span>
            <input
              data-autofocus
              type={dialog.inputType || 'text'}
              value={values.value ?? ''}
              placeholder={dialog.placeholder || ''}
              onChange={(event) => setValues({ value: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
              className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-3 text-white font-bold outline-none"
            />
          </label>
        ) : null}

        {dialog.type === 'form' ? (
          <div className="space-y-3">
            {(dialog.fields || []).map((field, index) => (
              <label key={field.name} className="block space-y-1.5">
                <span className="text-xs font-bold uppercase text-slate-400">{field.label}</span>
                {field.type === 'select' ? (
                  <select
                    data-autofocus={index === 0 ? true : undefined}
                    value={values[field.name] ?? ''}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-3 text-white font-bold outline-none"
                  >
                    {(field.options || []).map((option) => (
                      <option key={option.value ?? option} value={option.value ?? option}>
                        {option.label ?? option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    data-autofocus={index === 0 ? true : undefined}
                    type={field.type || 'text'}
                    value={values[field.name] ?? ''}
                    placeholder={field.placeholder || ''}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-3 text-white font-bold outline-none"
                  />
                )}
              </label>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
          {dialog.type !== 'alert' ? (
            <button
              type="button"
              onClick={cancel}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-2xl text-sm border border-slate-700 transition"
            >
              {dialog.cancelLabel || 'Отмена'}
            </button>
          ) : null}
          <button
            type="button"
            data-autofocus={dialog.type === 'alert' || dialog.type === 'confirm' ? true : undefined}
            onClick={submit}
            className={`flex-1 font-orbitron font-extrabold py-3 px-4 rounded-2xl text-sm uppercase transition ${variant.primary}`}
          >
            {dialog.confirmLabel || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
