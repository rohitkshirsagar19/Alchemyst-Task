import type { FormEvent } from "react";

type MessageInputProps = {
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  value: string;
};

export function MessageInput({ disabled, onChange, onSubmit, value }: MessageInputProps) {
  return (
    <form className="composer" onSubmit={onSubmit}>
      <label className="composer__label" htmlFor="message">
        USER_MESSAGE
      </label>
      <div className="composer__row">
        <input
          id="message"
          name="message"
          className="composer__input"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={disabled ? "Wait for the current turn or reconnect to finish" : "Type a prompt for the agent server"}
        />
        <button type="submit" className="composer__button" disabled={disabled}>
          Send
        </button>
      </div>
    </form>
  );
}
