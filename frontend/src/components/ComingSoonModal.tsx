"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComingSoonModal({ isOpen, onClose }: ComingSoonModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (isOpen && !element.open) element.showModal();
    if (!isOpen && element.open) element.close();
  }, [isOpen]);

  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="planned-feature-title"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 text-white shadow-2xl backdrop:bg-black/80">
      <button type="button" onClick={onClose} aria-label="Close planned feature dialog"
        className="absolute right-4 top-4 p-2 text-zinc-300 hover:text-white"><X className="h-4 w-4" /></button>
      <h2 id="planned-feature-title" className="mb-4 flex items-center gap-2 font-bold"><Sparkles className="h-5 w-5" />Coming Soon</h2>
      <p className="text-sm text-zinc-300">Paid plans and enterprise features are planned. Billing and a waitlist service are not implemented.</p>
      <p className="mt-3 text-sm text-zinc-300">Use the contact form for questions. No email is collected by this dialog.</p>
      <Button onClick={onClose} variant="outline" className="mt-5">Close</Button>
    </dialog>
  );
}
