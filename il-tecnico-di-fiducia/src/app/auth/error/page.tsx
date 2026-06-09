type Props = {
  searchParams: Promise<{ message?: string }>;
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const { message } = await searchParams;
  const text = typeof message === "string" && message.length > 0 ? message : null;

  return (
    <div className="mx-auto w-full max-w-[512px] bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-lg shadow-[0_4px_20px_rgba(8,43,95,0.08)]">
        <h1 className="font-headline-md text-headline-md text-primary mb-sm">
          Errore di autenticazione
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {text ?? "Si è verificato un errore. Riprova oppure contatta il supporto."}
        </p>
      </div>
  );
}
