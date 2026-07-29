import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { practices } from "@/db/schema";
import { requireOperator } from "@/lib/auth";
import { createPractice } from "@/app/admin/actions";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Mirror";

async function handleCreatePractice(formData: FormData): Promise<void> {
  "use server";
  const name = formData.get("name");
  const slug = formData.get("slug");
  const website = formData.get("website");
  if (typeof name !== "string" || typeof slug !== "string" || !name.trim() || !slug.trim()) return;
  await createPractice({
    name: name.trim(),
    slug: slug.trim(),
    website: typeof website === "string" && website.trim() ? website.trim() : undefined,
  });
}

export default async function AdminPage() {
  await requireOperator();
  const db = getDb();
  const allPractices = await db.select().from(practices).orderBy(desc(practices.createdAt));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{appName} — Practices</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage the practices, prompts, and fact sheets that {appName} monitors.
        </p>
      </header>

      <section className="mb-10 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Add a practice</h2>
        <form action={handleCreatePractice} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            name="name"
            required
            placeholder="Practice name"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <input
            name="slug"
            required
            placeholder="slug"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <input
            name="website"
            type="url"
            placeholder="https://example.com (optional)"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:col-span-3 sm:w-fit dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Create practice
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-black dark:text-zinc-50">Practices</h2>
        {allPractices.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No practices yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Slug</th>
                <th className="py-2 pr-4 font-medium">Website</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {allPractices.map(practice => (
                <tr key={practice.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/practices/${practice.id}`}
                      className="font-medium text-black underline-offset-2 hover:underline dark:text-zinc-50"
                    >
                      {practice.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{practice.slug}</td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">{practice.website ?? "—"}</td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                    {practice.active ? "Active" : "Inactive"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
