import type { ReactNode } from "react";

export type DebugEntry = {
  id: number;
  direction: "system" | "outbound" | "received" | "processed" | "invalid";
  title: string;
  detail: string;
  timestamp: string;
};

type TransportDebugConsoleProps = {
  entries: DebugEntry[];
  footer?: ReactNode;
};

export function TransportDebugConsole({ entries, footer }: TransportDebugConsoleProps) {
  return (
    <section className="debug-log">
      <div className="debug-log__header">
        <p className="card__label">Debug events</p>
        <p className="debug-log__meta">{entries.length} recent</p>
      </div>
      <div className="debug-log__entries">
        {entries.length === 0 ? (
          <article className="list-row">
            <p className="list-row__label">No events yet</p>
            <p className="list-row__detail">Connect to the backend and send a message to inspect raw protocol traffic.</p>
          </article>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className={`list-row list-row--${entry.direction}`}>
              <div className="debug-log__entry-header">
                <p className="list-row__label">{entry.title}</p>
                <span className="debug-log__timestamp">{entry.timestamp}</span>
              </div>
              <pre className="debug-log__detail">{entry.detail}</pre>
            </article>
          ))
        )}
      </div>
      {footer ? <div className="debug-log__footer">{footer}</div> : null}
    </section>
  );
}
