import type { ReactNode } from "react";
import { Tag } from "@/components/ui";
import { BackToAdmin } from "@/app/admin/ui";

/**
 * The top of both pages about one business (the editing page and the
 * read-only customer overview): its name, whether it is active, one line of
 * details, the buttons for that page, then that page's tabs.
 */
export function BusinessHeader({ name, active, details, actions, children }: {
  name: string;
  active: boolean;
  details: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="mb-8">
      <BackToAdmin />
      <div className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-ink">{name}</h1>
            {active ? <Tag tone="ok">Active</Tag> : <Tag>Paused</Tag>}
          </div>
          <p className="mt-1 break-words text-[14px] text-muted">{details}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {children}
    </header>
  );
}
