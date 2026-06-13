import type { ToolStreamBlock } from "@/lib/store/agentStore";

type ToolCallCardProps = {
  block: ToolStreamBlock;
};

export function ToolCallCard({ block }: ToolCallCardProps) {
  return (
    <article className="tool-card">
      <div className="tool-card__header">
        <div>
          <p className="card__label">Tool</p>
          <p className="tool-card__title">{block.toolName}</p>
        </div>
        <span className={`status-badge status-badge--${block.status}`}>{block.status}</span>
      </div>
      <dl className="tool-card__meta">
        <div>
          <dt>Call ID</dt>
          <dd>{block.callId}</dd>
        </div>
        <div>
          <dt>Seq</dt>
          <dd>{block.callSeq}{block.resultSeq ? ` -> ${block.resultSeq}` : ""}</dd>
        </div>
      </dl>
      <div className="tool-card__payload">
        <p className="card__label">Args</p>
        <pre className="tool-card__code">{JSON.stringify(block.args, null, 2)}</pre>
      </div>
      <div className="tool-card__payload">
        <p className="card__label">Result</p>
        <pre className="tool-card__code">
          {block.result !== undefined ? JSON.stringify(block.result, null, 2) : "Waiting for tool result..."}
        </pre>
      </div>
    </article>
  );
}
