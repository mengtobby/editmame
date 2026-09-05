import type { ReactNode } from "react";

interface ToolbarButtonProps {
  onClick?: () => void;
  icon: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

/** Icon + label button matching Google Docs' toolbar row: quiet by default, a light gray fill
 *  on hover, no border — the toolbar's rest state should read as calm, not as a wall of buttons. */
export function ToolbarButton({ onClick, icon, children, disabled }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="text-gray-500">{icon}</span>
      {children}
    </button>
  );
}
