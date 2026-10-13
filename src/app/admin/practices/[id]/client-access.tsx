"use client";

import { useActionState } from "react";
import { Card, Note, Tag } from "@/components/ui";
import { Button, Notice, TextInput } from "@/app/admin/ui";

export interface ClientMember {
  id: string;
  email: string;
  hasPassword: boolean;
  mustChangePassword: boolean;
}

export interface IssueResult {
  email?: string;
  password?: string;
  error?: string;
}

/**
 * Customer login panel. A client component rather than a plain server form
 * because the issued password has to come *back* to the screen, and the two
 * obvious server-only routes both leak it: a redirect puts it in the URL, and
 * therefore in browser history and access logs, and storing it to read on the
 * next render means writing a plaintext password down. `useActionState` keeps
 * it in the response to this one submit and nowhere else.
 */
export function ClientAccess({
  members,
  issue,
}: {
  members: ClientMember[];
  issue: (previous: IssueResult, formData: FormData) => Promise<IssueResult>;
}) {
  const [state, formAction, pending] = useActionState(issue, {});

  return (
    <div className="space-y-4">
      <Card title="Customer login">
        <Note>
          Makes the account and a one-time password to read to the customer on the first call. They sign in at
          /login and must choose their own password before they see anything.
        </Note>

        <form action={formAction} className="mt-4 flex flex-wrap gap-3">
          <TextInput name="email" type="email" required placeholder="owner@business.com" aria-label="Customer email" className="flex-1" />
          <Button disabled={pending}>{pending ? "Working..." : "Create password"}</Button>
        </form>

        {state.error && <Notice tone="flag" className="mt-3">{state.error}</Notice>}

        {state.password && (
          <div className="mt-3 rounded-2xl bg-gold-soft px-4 py-3">
            <p className="text-[14px] leading-relaxed text-ink">
              Temporary password for {state.email}. Read it out now. It is not shown again and is not saved anywhere
              you can look it up.
            </p>
            <p className="mt-2 font-mono text-[20px] tracking-wide text-ink">{state.password}</p>
          </div>
        )}
      </Card>

      <Card title="Who can sign in">
        {members.length === 0 ? <Note>Nobody yet.</Note> : (
          <>
            <ul className="divide-y divide-line">
              {members.map(member => (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span className="break-all text-[15px] text-ink">{member.email}</span>
                  {!member.hasPassword
                    ? <Tag>No password, email link only</Tag>
                    : member.mustChangePassword
                      ? <Tag tone="gold">Temporary password, not changed yet</Tag>
                      : <Tag tone="ok">Password set</Tag>}
                </li>
              ))}
            </ul>
            <Note className="mt-3">
              To reset a password, enter the same address again above. The old password stops working right away.
            </Note>
          </>
        )}
      </Card>
    </div>
  );
}
