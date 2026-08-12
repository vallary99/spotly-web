export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="text-2xl font-semibold text-warm-brown">{title}</h2>
    </div>
  );
}
