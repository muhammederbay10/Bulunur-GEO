import type { LucideIcon } from "lucide-react";

type PhasePlaceholderProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  items: string[];
};

export function PhasePlaceholder({
  title,
  description,
  icon: Icon,
  items,
}: PhasePlaceholderProps) {
  return (
    <section className="industrial-panel p-6">
      <div className="flex items-start gap-4">
        <div className="border border-border/70 bg-background/50 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="border border-border/60 bg-background/30 p-4">
            <p className="text-sm text-muted-foreground">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
