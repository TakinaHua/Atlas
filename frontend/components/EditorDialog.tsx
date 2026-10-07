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
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit}>
        <h2>{title}</h2>
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
