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
        <div className="panel__heading">
          <h2 className="panel__title">{title}</h2>
          {description ? <p className="panel__description">{description}</p> : null}
        </div>
        {headerSlot ? <div className="panel__header-slot">{headerSlot}</div> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
