import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, ...props }: InputProps) {
  return (
    <div>
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <input id={id} className="form-input" {...props} />
      {error && <p style={{ fontSize: 11, color: 'var(--rd)', marginTop: 4 }}>{error}</p>}
    </div>
  );
}
