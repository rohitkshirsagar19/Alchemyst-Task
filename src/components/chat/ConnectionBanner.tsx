import { AGENT_WS_URL } from "@/lib/config/env";

export function ConnectionBanner() {
  return (
    <div className="status-banner">
      <span className="status-banner__dot" aria-hidden="true" />
      <div>
        <p className="status-banner__label">Connection target</p>
        <p className="status-banner__value">{AGENT_WS_URL}</p>
      </div>
    </div>
  );
}
