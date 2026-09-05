interface AvatarProps {
  label: string;
  color: string;
  size?: "sm" | "md";
  ring?: boolean;
}

/** Circular initial avatar, the collaborator-identity unit Google Docs uses everywhere: the top
 *  bar's presence stack, the share dialog, cursor labels. One consistent shape carries "a person
 *  is here" across the whole app. */
export function Avatar({ label, color, size = "md", ring = true }: AvatarProps) {
  const initials = label
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const dimensions = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";

  return (
    <div
      title={label}
      data-testid="peer-avatar"
      className={`flex shrink-0 items-center justify-center rounded-full font-medium text-white ${dimensions} ${
        ring ? "ring-2 ring-white" : ""
      }`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}
