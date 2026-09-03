import { useCallback, useRef, useState } from 'react';

/**
 * Promise-based UI dialogs to replace window.alert / confirm / prompt.
 */
export function useAppDialog() {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const close = useCallback((value) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    if (resolve) resolve(value);
  }, []);

  const openDialog = useCallback((config) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog(config);
    });
  }, []);

  const uiAlert = useCallback((message, options = {}) => {
    return openDialog({
      type: 'alert',
      title: options.title || 'Сообщение',
      message,
      variant: options.variant || 'info',
      confirmLabel: options.confirmLabel || 'OK',
    });
  }, [openDialog]);

  const uiConfirm = useCallback((message, options = {}) => {
    return openDialog({
      type: 'confirm',
      title: options.title || 'Подтверждение',
      message,
      variant: options.variant || 'danger',
      confirmLabel: options.confirmLabel || 'Да',
      cancelLabel: options.cancelLabel || 'Отмена',
    });
  }, [openDialog]);

  const uiPrompt = useCallback((message, options = {}) => {
    return openDialog({
      type: 'prompt',
      title: options.title || 'Ввод',
      message,
      variant: options.variant || 'info',
      defaultValue: options.defaultValue ?? '',
      inputType: options.inputType || 'text',
      placeholder: options.placeholder || '',
      confirmLabel: options.confirmLabel || 'OK',
      cancelLabel: options.cancelLabel || 'Отмена',
    });
  }, [openDialog]);

  const uiForm = useCallback((options) => {
    return openDialog({
      type: 'form',
      title: options.title || 'Форма',
      message: options.message || '',
      variant: options.variant || 'info',
      fields: options.fields || [],
      confirmLabel: options.confirmLabel || 'Сохранить',
      cancelLabel: options.cancelLabel || 'Отмена',
    });
  }, [openDialog]);

  return { dialog, close, uiAlert, uiConfirm, uiPrompt, uiForm };
}
