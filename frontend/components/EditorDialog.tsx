'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

/** Native dialog gives keyboard focus trapping and Escape-to-close support. */
export default function EditorDialog({
  title,
  onClose,
  onSave,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      await onSave(data);
      onClose();
    } catch (error) {
      // Keep the user's input in the open form when the server rejects a save.
      setError(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="editor-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">MAKE IT YOUR OWN</p>
            <h2 id="editor-title">{title}</h2>
          </div>
          <button
            type="button"
            className="close-button secondary"
            aria-label="Close editor"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <fieldset disabled={saving}>{children}</fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" className="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
