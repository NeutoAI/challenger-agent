"use client";

import { CENTER } from "@/lib/constants";
import type { Segment } from "@/lib/types";

export function SegmentPicker({ lang, onPick }: { lang: "en" | "es"; onPick: (segment: Segment) => void }) {
  const copy =
    lang === "es"
      ? {
          title: `Hola, bienvenido a ${CENTER.name}`,
          subtitle: "Para darte la mejor respuesta, cuéntanos un poco sobre ti.",
          prospectiveTitle: "Estoy considerando inscribirme",
          prospectiveSub: "Tours, cupos disponibles, matrícula",
          enrolledTitle: "Ya somos familia inscrita",
          enrolledSub: "Horarios, políticas, recogida y más",
        }
      : {
          title: `Hi, welcome to ${CENTER.name}`,
          subtitle: "So we can give you the best answer, tell us a bit about you.",
          prospectiveTitle: "I'm exploring enrollment",
          prospectiveSub: "Tours, availability, tuition",
          enrolledTitle: "I'm a current family",
          enrolledSub: "Hours, policies, pickup, and more",
        };

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 text-center py-16">
      <div>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-neutral-600 mt-2 max-w-sm mx-auto">{copy.subtitle}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <button
          onClick={() => onPick("prospective")}
          className="flex-1 rounded-2xl border-2 p-5 text-left hover:shadow-md transition-shadow bg-white"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="font-semibold">{copy.prospectiveTitle}</p>
          <p className="text-sm text-neutral-500 mt-1">{copy.prospectiveSub}</p>
        </button>
        <button
          onClick={() => onPick("enrolled")}
          className="flex-1 rounded-2xl border-2 p-5 text-left hover:shadow-md transition-shadow bg-white"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="font-semibold">{copy.enrolledTitle}</p>
          <p className="text-sm text-neutral-500 mt-1">{copy.enrolledSub}</p>
        </button>
      </div>
    </div>
  );
}
