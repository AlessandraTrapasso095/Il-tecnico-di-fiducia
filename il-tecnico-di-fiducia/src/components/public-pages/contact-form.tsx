"use client";

import { useState } from "react";

import { fetchJson } from "@/lib/api/fetch-json";

type ContactTicketResponse = {
  ok: true;
  ticket_id: string;
  email_sent: boolean;
};

const INITIAL_STATE = {
  firstName: "",
  lastName: "",
  email: "",
  title: "",
  message: "",
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function ContactForm() {
  const [form, setForm] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof typeof INITIAL_STATE, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitContact(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const payload = {
        first_name: normalize(form.firstName),
        last_name: normalize(form.lastName),
        email: form.email.trim().toLowerCase(),
        subject: normalize(form.title),
        body: form.message.trim(),
      };

      await fetchJson<ContactTicketResponse>("/api/public/contact-ticket", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setForm(INITIAL_STATE);
      setSuccess(
        "Richiesta inviata. Il nostro team la prenderà in carico il prima possibile.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Non è stato possibile inviare la richiesta. Riprova.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="rounded-[28px] border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-[0_18px_60px_rgba(8,43,95,0.12)] sm:p-8"
      onSubmit={submitContact}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nome"
          value={form.firstName}
          onChange={(value) => updateField("firstName", value)}
          required
        />
        <TextField
          label="Cognome"
          value={form.lastName}
          onChange={(value) => updateField("lastName", value)}
          required
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={(value) => updateField("email", value)}
          required
        />
        <TextField
          label="Titolo"
          value={form.title}
          onChange={(value) => updateField("title", value)}
          required
        />
      </div>
      <label className="mt-4 block font-label-md text-primary">
        Messaggio
        <textarea
          className="mt-2 min-h-40 w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          required
        />
      </label>

      {success ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl bg-error-container p-4 text-on-error-container">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#FF8500] px-6 py-3 font-button text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#FF9A2B] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        disabled={loading}
      >
        {loading ? "Invio in corso…" : "Invia richiesta"}
      </button>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block font-label-md text-primary">
      {label}
      <input
        className="mt-2 h-12 w-full rounded-2xl border border-outline-variant bg-white px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}
