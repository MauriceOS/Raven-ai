import { useState } from "react";
import type { ApiResponse } from "../api";
import { IconSend } from "./Icons";

interface AskPanelProps {
  onAsk: (message: string) => Promise<ApiResponse<{ response?: string }>>;
}

export function AskPanel({ onAsk }: AskPanelProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const submit = async () => {
    const msg = input.trim();
    if (!msg || busy) return;
    setBusy(true);
    setOpen(true);
    try {
      const res = await onAsk(msg);
      setAnswer(res.data?.response || res.message || "Done.");
      setInput("");
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ask-panel">
      <button
        type="button"
        className="ask-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Ask something else</span>
        <span className="follow-up-chevron">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="ask-body">
          <div className="ask-compose">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="e.g. Which domain should I study first?"
              disabled={busy}
            />
            <button
              type="button"
              className="btn btn-icon"
              disabled={busy || !input.trim()}
              aria-label="Send"
              onClick={submit}
            >
              <IconSend />
            </button>
          </div>
          {busy && <p className="ask-status">Thinking...</p>}
          {answer && !busy && (
            <div className="ask-answer">
              <p>{answer}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
