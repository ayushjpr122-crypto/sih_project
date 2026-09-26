import type { ViewKey } from "../nav";
import { LOCKED_WITHOUT_RESULT, VIEWS } from "../nav";

export default function Nav({
  view,
  onNavigate,
  hasResult,
}: {
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
  hasResult: boolean;
}) {
  return (
    <nav aria-label="Primary" className="bg-white border-b border-line">
      <div className="mx-auto max-w-ops px-4 sm:px-6">
        {/* Mobile: horizontal scroll; desktop: single row */}
        <ul className="flex gap-1 overflow-x-auto">
          {VIEWS.map((v) => {
            const disabled = !hasResult && LOCKED_WITHOUT_RESULT.includes(v.key);
            return (
              <li key={v.key} className="shrink-0">
                {disabled ? (
                  <span
                    className="nav-link inline-block cursor-not-allowed opacity-40"
                    aria-disabled="true"
                    title="Run an analysis to unlock this section"
                  >
                    <span className="mr-1.5 font-mono text-[10px] text-slate-400">{v.index}</span>
                    {v.label}
                  </span>
                ) : (
                  <a
                    href={`#/${v.key}`}
                    className="nav-link inline-block"
                    aria-current={view === v.key ? "page" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(v.key);
                    }}
                  >
                    <span className="mr-1.5 font-mono text-[10px] text-ocean-600">{v.index}</span>
                    {v.label}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
