"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordField } from "@/components/auth/password-field";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isReady, setIsReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setHasSession(Boolean(data.user));
      setIsReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      return;
    }

    if (password !== confirm) {
      setError("Le password non coincidono.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    // Safety: after resetting, require a fresh login.
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="mx-auto w-full max-w-[448px] bg-surface-container-lowest rounded-[20px] p-6 shadow-[0_4px_20px_rgba(8,43,95,0.08)] border border-outline-variant/30">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Reimposta password
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          Inserisci una nuova password per completare il recupero.
        </p>

        {!isReady ? (
          <div className="text-on-surface-variant">Caricamento…</div>
        ) : !hasSession ? (
          <div className="space-y-4">
            <p className="text-on-surface-variant">
              Sessione non valida o scaduta. Richiedi un nuovo link di recupero
              password.
            </p>
            <button
              className="w-full bg-primary text-white rounded-full py-3 font-button text-button hover:bg-secondary transition-colors"
              onClick={() => router.push("/")}
              type="button"
            >
              Torna alla home
            </button>
          </div>
        ) : done ? (
          <div className="space-y-4">
            <p className="text-on-surface-variant">
              Password aggiornata. Effettua di nuovo il login.
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <PasswordField
              label="Nuova password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              required
            />

            <PasswordField
              label="Conferma password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              required
            />

            {error ? (
              <div className="text-on-error-container bg-error-container border border-error/20 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            ) : null}

            <button
              className="w-full bg-[#FF8500] hover:bg-[#FF9A2B] text-white rounded-full py-3 font-button text-button shadow-md transition-all active:scale-[0.99]"
              type="submit"
            >
              Aggiorna password
            </button>
          </form>
        )}
      </div>
  );
}
