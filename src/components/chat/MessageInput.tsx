export function MessageInput() {
  return (
    <form className="composer">
      <label className="composer__label" htmlFor="message">
        Message
      </label>
      <div className="composer__row">
        <input
          id="message"
          name="message"
          className="composer__input"
          placeholder="Phase 1 scaffold: input wiring starts next."
          disabled
        />
        <button type="button" className="composer__button" disabled>
          Send
        </button>
      </div>
    </form>
  );
}
