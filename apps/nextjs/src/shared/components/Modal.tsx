"use client";

import { useEffect } from "react";
import { Button } from "@/shared/components/ui";

/**
 * A simple centred dialog. Escape closes it, and the body is locked while it is open
 * so the page behind cannot scroll away underneath.
 */
export function Modal({
  isOpen,
  title,
  onClose,
  children,
  footer,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    // Leaflet's own panes and zoom controls use z-index values up to ~1000 (see
    // leaflet.css), so a modal opened over a map — the admin map's create/edit
    // dialogs — needs to clear that, not just Tailwind's usual z-50 stacking.
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-2 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-(--panel-border) bg-(--panel-bg) p-4 sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-(--text-primary) sm:text-lg">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Maak toe" className="shrink-0">
            &times;
          </Button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Bevestig",
  onConfirm,
  onCancel,
  isBusy = false,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isBusy?: boolean;
}) {
  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
            Kanselleer
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isBusy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-(--text-secondary)">{message}</p>
    </Modal>
  );
}
