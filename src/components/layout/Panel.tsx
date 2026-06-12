import type { PropsWithChildren, ReactNode } from "react";

type PanelProps = PropsWithChildren<{
  title: string;
  description?: string;
  headerSlot?: ReactNode;
}>;

export function Panel({ title, description, headerSlot, children }: PanelProps) {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">{title}</p>
          {description ? <h2 className="panel__title">{description}</h2> : null}
        </div>
        {headerSlot ? <div>{headerSlot}</div> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
