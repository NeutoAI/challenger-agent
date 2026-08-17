"use client";

import { useState } from "react";

export function FeedbackPrompt({
  lang,
  onSubmit,
}: {
  lang: "en" | "es";
  onSubmit: (feedback: "up" | "down", text?: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "down-detail" | "done">("idle");
  const [text, setText] = useState("");

  const copy =
    lang === "es"
      ? { prompt: "¿Esto respondió tu pregunta?", placeholder: "¿Qué necesitabas? (opcional)", submit: "Enviar", thanks: "¡Gracias por tu opinión!" }
      : { prompt: "Did this answer your question?", placeholder: "What did you need? (optional)", submit: "Submit", thanks: "Thanks for the feedback!" };

  if (status === "done") {
    return <p className="text-xs text-neutral-500 mt-2">{copy.thanks}</p>;
  }

  if (status === "down-detail") {
    return (
      <div className="mt-2 flex flex-col gap-1.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={copy.placeholder}
          rows={2}
          className="text-xs rounded-lg border px-2 py-1.5 w-full resize-none"
          style={{ borderColor: "var(--border)" }}
        />
        <button
          onClick={() => {
            onSubmit("down", text || undefined);
            setStatus("done");
          }}
          className="self-start text-xs font-medium px-2.5 py-1 rounded-full text-white"
          style={{ background: "var(--brand)" }}
        >
          {copy.submit}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-neutral-500">{copy.prompt}</span>
      <button
        aria-label="thumbs up"
        onClick={() => {
          onSubmit("up");
          setStatus("done");
        }}
        className="text-sm hover:scale-110 transition-transform"
      >
        👍
      </button>
      <button aria-label="thumbs down" onClick={() => setStatus("down-detail")} className="text-sm hover:scale-110 transition-transform">
        👎
      </button>
    </div>
  );
}
