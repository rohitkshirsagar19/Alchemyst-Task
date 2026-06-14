import { AGENT_WS_URL } from "@/lib/config/env";
import type { WebSocketConnectionStatus } from "@/lib/websocket/websocketManager";

type ConnectionBannerProps = {
  attempt?: number;
  delayMs?: number;
  resumeSeq?: number;
  status: WebSocketConnectionStatus;
};

export function ConnectionBanner({ attempt, delayMs, resumeSeq, status }: ConnectionBannerProps) {
  const { label, value } = bannerText(status, attempt, delayMs, resumeSeq);

  return (
    <div className={`status-banner status-banner--${status}`}>
      <span className="status-banner__dot" aria-hidden="true" />
      <div>
        <p className="status-banner__label">{label}</p>
        <p className="status-banner__value">{value}</p>
      </div>
      <p className="status-banner__target">{AGENT_WS_URL}</p>
    </div>
  );
}

function bannerText(
  status: WebSocketConnectionStatus,
  attempt?: number,
  delayMs?: number,
  resumeSeq?: number,
): { label: string; value: string } {
  if (status === "reconnecting") {
    return {
      label: "Reconnecting",
      value: `Attempt ${attempt ?? 1}${delayMs !== undefined ? ` in ${delayMs}ms` : ""}`,
    };
  }

  if (status === "resuming") {
    return {
      label: "Resuming",
      value: `Resuming from seq ${resumeSeq ?? 0}`,
    };
  }

  if (status === "closed") {
    return {
      label: "Disconnected",
      value: "Connection closed",
    };
  }

  return {
    label: "Connection target",
    value: AGENT_WS_URL,
  };
}
