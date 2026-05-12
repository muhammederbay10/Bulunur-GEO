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
    <section className="seller-surface p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border/70 bg-background text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="rounded-md border border-border/60 bg-background/70 p-4">
            <p className="text-sm leading-6 text-muted-foreground">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
