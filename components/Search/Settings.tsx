"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@chakra-ui/react";
import {
  ArrowUpRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Trash2,
  X,
} from "lucide-react";
import { normalizeApiKey } from "@/lib/api-key";

export function Settings({
  apiKey,
  busy,
  storageError,
  onSave,
  onClose,
}: {
  apiKey: string;
  busy: boolean;
  storageError: string;
  onSave: (key: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(apiKey);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal settings-modal"
      aria-labelledby="settings-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <span className="eyebrow">
            <KeyRound size={13} /> INTERFAZE API KEY
          </span>
          <Button variant="ghost" aria-label="Close settings" onClick={onClose}>
            <X />
          </Button>
        </header>
        <h2 id="settings-title">Connect Interfaze</h2>
        <p className="modal-intro">
          Add your Interfaze API key to start searching. Need a key? Get one
          from your Interfaze account.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            const key = normalizeApiKey(draft);
            if (!key) {
              setError(
                "Enter an API key without spaces, up to 4,096 characters.",
              );
              return;
            }
            onSave(key);
            setVisible(false);
            setError("");
            onClose();
          }}
        >
          <label className="field-label" htmlFor="api-key">
            Interfaze API key
          </label>
          <div className="key-field">
            <input
              id="api-key"
              type={visible ? "text" : "password"}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError("");
              }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={4096}
              placeholder="Paste your Interfaze key"
              disabled={busy}
              aria-invalid={!!error}
              aria-describedby="key-description"
            />
            <Button
              type="button"
              variant="ghost"
              aria-label={visible ? "Hide API key" : "Show API key"}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <p id="key-description" className="fine-print">
            Saved in this tab’s session storage. Browser session restore may
            retain it. Remove it here when you’re done.
          </p>
          <a
            className="text-link"
            href="https://interfaze.ai/auth"
            target="_blank"
            rel="noreferrer"
          >
            Get an Interfaze API key <ArrowUpRight size={13} />
          </a>
          <div className="settings-actions">
            <Button type="submit" disabled={busy || !draft.trim()}>
              <KeyRound /> Save API key
            </Button>
            {apiKey && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  onSave("");
                  setDraft("");
                  setVisible(false);
                }}
              >
                <Trash2 /> Remove key
              </Button>
            )}
          </div>
          {busy && (
            <p className="fine-print">
              Stop the current search before changing your key.
            </p>
          )}
          {error && (
            <p className="error-note" role="alert">
              {error}
            </p>
          )}
          {storageError && (
            <p className="error-note" role="alert">
              {storageError}
            </p>
          )}
        </form>
        <div className="privacy-note">
          <LockKeyhole size={16} />
          <p>
            Your key is sent only to api.interfaze.ai. Your account’s limits and
            usage charges apply. Results stay in this tab.
          </p>
        </div>
      </div>
    </dialog>
  );
}
