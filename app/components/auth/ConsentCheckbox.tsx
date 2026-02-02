"use client";

import Link from "next/link";

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: boolean;
}

export function ConsentCheckbox({ checked, onChange, error }: ConsentCheckboxProps) {
  return (
    <div className={`rounded-lg border p-4 ${error ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50"}`}>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-600 leading-relaxed">
          I agree to the{" "}
          <Link href="/terms" className="text-blue-600 hover:underline" target="_blank">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-blue-600 hover:underline" target="_blank">
            Privacy Policy
          </Link>
          . I understand that Integrity Scores reflect community consensus and{" "}
          <strong>do not constitute professional evaluation, certification, or guarantee</strong> of AI safety or capability.
        </span>
      </label>
      {error && (
        <p className="mt-2 text-xs text-red-600">
          You must agree to the terms to create an account.
        </p>
      )}
    </div>
  );
}
