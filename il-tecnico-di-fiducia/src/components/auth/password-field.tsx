"use client";

import { useId, useState } from "react";

type PasswordFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
};

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
  required,
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      {label ? (
        <label className="font-label-md text-label-md text-on-surface-variant" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={id}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 pr-12 font-body-md text-body-md outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
          aria-label={visible ? "Nascondi password" : "Mostra password"}
          onClick={() => setVisible((current) => !current)}
        >
          <span className="material-symbols-outlined text-[21px]">
            {visible ? "visibility_off" : "visibility"}
          </span>
        </button>
      </div>
    </div>
  );
}
