export function Badge({
  label,
  color,
  size = 40,
}: {
  label: string;
  color?: string | null;
  size?: number;
}) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        background: color || "#C0392B",
        fontSize: size * 0.32,
      }}
    >
      {label}
    </div>
  );
}
