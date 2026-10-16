import { useEffect, useId, useRef, useState } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const VARIANT_META = {
  info: {
    icon: 'fa-circle-info',
    tone: 'info',
  },
  danger: {
    icon: 'fa-triangle-exclamation',
    tone: 'danger',
  },
  success: {
    icon: 'fa-circle-check',
    tone: 'success',
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
  useBodyScrollLock(!!dialog);

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

  const variant = VARIANT_META[dialog.variant] || VARIANT_META.info;

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
      className="app-dialog-overlay modal-overlay"
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
        className={`app-dialog app-dialog--${variant.tone} modal-scroll`}
      >
        <div className="app-dialog-head">
          <div className="app-dialog-icon" aria-hidden="true">
            <i className={`fa-solid ${variant.icon}`} />
          </div>
          <div className="app-dialog-copy">
            <h3 id={titleId} className="app-dialog-title">
              {dialog.title}
            </h3>
            {dialog.message ? (
              <p id={descId} className="app-dialog-message">
                {dialog.message}
              </p>
            ) : null}
          </div>
        </div>

        {dialog.type === 'prompt' ? (
          <label className="app-dialog-field">
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
              className="app-dialog-input"
            />
          </label>
        ) : null}

        {dialog.type === 'form' ? (
          <div className="app-dialog-fields">
            {(dialog.fields || []).map((field, index) => (
              <label key={field.name} className="app-dialog-field">
                <span className="app-dialog-label">{field.label}</span>
                {field.type === 'select' ? (
                  <select
                    data-autofocus={index === 0 ? true : undefined}
                    value={values[field.name] ?? ''}
                    onChange={(event) =>
                      setValues((prev) => ({ ...prev, [field.name]: event.target.value }))
                    }
                    className="app-dialog-input"
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
                    className="app-dialog-input"
                  />
                )}
              </label>
            ))}
          </div>
        ) : null}

        <div className="app-dialog-actions">
          {dialog.type !== 'alert' ? (
            <button type="button" onClick={cancel} className="app-dialog-btn app-dialog-btn--ghost">
              {dialog.cancelLabel || 'Отмена'}
            </button>
          ) : null}
          <button
            type="button"
            data-autofocus={dialog.type === 'alert' || dialog.type === 'confirm' ? true : undefined}
            onClick={submit}
            className="app-dialog-btn app-dialog-btn--primary"
          >
            {dialog.confirmLabel || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
