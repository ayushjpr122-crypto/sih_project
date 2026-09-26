import type { ViewKey } from "../nav";
import { VIEWS } from "../nav";

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
    <nav aria-label="Primary" className="bg-white border-b border-slate-200">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        {/* Mobile: horizontal scroll; desktop: single row */}
        <ul className="flex gap-1 overflow-x-auto">
          {VIEWS.map((v) => {
            const disabled = !hasResult && v.key !== "overview" && v.key !== "scenario";
            return (
              <li key={v.key} className="shrink-0">
                {disabled ? (
                  <span
                    className="nav-link inline-block cursor-not-allowed opacity-40"
                    aria-disabled="true"
                    title="Run an analysis to unlock this section"
                  >
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
