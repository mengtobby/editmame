import type { MediaImportApi } from "@/hooks/useMediaImport";

interface ImportButtonProps {
  mediaImport: MediaImportApi;
}

export function ImportButton({ mediaImport }: ImportButtonProps) {
  const { busy, inputRef, triggerPicker, handleInputChange } = mediaImport;

  return (
    <button
      type="button"
      onClick={triggerPicker}
      disabled={busy}
      title="Import media from your device"
      className="flex cursor-pointer items-center gap-1.5 rounded px-2.5 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="text-gray-500">
        <UploadIcon />
      </span>
      {busy ? "Importing…" : "Import media"}
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={handleInputChange} />
    </button>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
      <path
        d="M8 10.5V2.5M8 2.5 5 5.5M8 2.5l3 3M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
