"use client";

import { InputHTMLAttributes, useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export default function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const inputType = isVisible ? "text" : "password";

  return (
    <div className="relative">
      <input
        {...props}
        type={inputType}
        className={`w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 pr-12 text-sm outline-none ring-purple-500/50 placeholder:text-zinc-500 focus:ring-2 ${className}`}
      />
      <button
        type="button"
        onClick={() => setIsVisible((prev) => !prev)}
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-200"
      >
        {isVisible ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3l18 18" strokeLinecap="round" />
            <path d="M10.58 10.58a2 2 0 0 0 2.84 2.84" strokeLinecap="round" />
            <path
              d="M9.88 5.09A10.9 10.9 0 0 1 12 4.91c5.05 0 8.27 3.11 9.5 6.09a1.78 1.78 0 0 1 0 1.36c-.42 1.02-1.1 2.09-2.03 3.08"
              strokeLinecap="round"
            />
            <path
              d="M6.6 6.61C4.6 7.74 3.24 9.45 2.5 11a1.78 1.78 0 0 0 0 1.36c1.23 2.98 4.45 6.09 9.5 6.09 1.28 0 2.46-.2 3.54-.54"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="M2.5 12c1.23-2.98 4.45-6.09 9.5-6.09s8.27 3.11 9.5 6.09a1.78 1.78 0 0 1 0 1.36c-1.23 2.98-4.45 6.09-9.5 6.09s-8.27-3.11-9.5-6.09a1.78 1.78 0 0 1 0-1.36Z"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12.68" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
