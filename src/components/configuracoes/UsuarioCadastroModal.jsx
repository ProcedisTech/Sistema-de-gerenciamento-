import React, {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Pencil, User, X } from "lucide-react";
import { PerfilProfissionalPanel } from "./PerfilProfissionalPanel";

export default function UsuarioCadastroModal({
  onClose,
  onSaved,
  onMediaAtualizada,
}) {
  const [readOnly, setReadOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const dialogRef = useRef(null);
  const titleId = useId();
  const interaction = useRef({ busy, signatureOpen, onClose });
  useLayoutEffect(() => {
    interaction.current = { busy, signatureOpen, onClose };
  }, [busy, signatureOpen, onClose]);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const handleKey = (event) => {
      const scope = interaction.current.signatureOpen
        ? dialogRef.current?.querySelector("[data-signature-dialog]")
        : dialogRef.current;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (interaction.current.signatureOpen) {
          scope?.querySelector('button[aria-label="Fechar"]')?.click();
        } else if (!interaction.current.busy) interaction.current.onClose?.();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        scope?.querySelectorAll(
          'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex="0"]',
        ) || [],
      ).filter(
        (element) =>
          !element.matches(":disabled") && !element.closest(".sr-only"),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        scope?.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === scope)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !scope?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKey);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (signatureOpen)
      dialogRef.current
        ?.querySelector("[data-signature-dialog] button")
        ?.focus();
    else dialogRef.current?.focus();
  }, [signatureOpen]);

  const close = () => {
    if (!busy && !signatureOpen) onClose?.();
  };
  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-black/60"
        onClick={close}
        aria-label="Fechar cadastro pelo fundo"
        disabled={busy}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg outline-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#00a88e] text-white shadow-sm">
              <User className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h3
                id={titleId}
                className="text-[18px] font-bold text-slate-900 sm:text-[20px]"
              >
                {readOnly ? "Cadastro do Usuário" : "Editar Cadastro"}
              </h3>
              <p className="text-[13px] font-medium text-slate-500">
                {readOnly
                  ? "Visualização dos dados cadastrais"
                  : "Atualize seus dados pessoais e de contato"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {readOnly && (
              <button
                type="button"
                onClick={() => setReadOnly(false)}
                className="flex items-center gap-1.5 rounded-lg border border-[#00a88e] bg-[#e6f7f5] px-3.5 py-2 text-[13px] font-bold text-[#00a88e] hover:bg-[#00a88e] hover:text-white"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Editar
              </button>
            )}
            <button
              type="button"
              onClick={close}
              disabled={busy}
              aria-label="Fechar cadastro do usuário"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8fbfb] px-5 py-4">
          <PerfilProfissionalPanel
            modal
            readOnly={readOnly}
            onCancel={close}
            onBusyChange={setBusy}
            onSignatureOpenChange={setSignatureOpen}
            onMediaAtualizada={onMediaAtualizada}
            onPerfilAtualizado={onSaved}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
