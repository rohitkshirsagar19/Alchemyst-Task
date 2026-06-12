type TimelineRowProps = {
  label: string;
  detail: string;
};

export function TimelineRow({ label, detail }: TimelineRowProps) {
  return (
    <article className="list-row">
      <p className="list-row__label">{label}</p>
      <p className="list-row__detail">{detail}</p>
    </article>
  );
}
