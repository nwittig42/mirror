import { redirect } from "next/navigation";
import { requirePracticeView } from "@/lib/auth";

/**
 * Sources used to be its own tab. It is now the second half of Competitors,
 * so this address sends everyone there, a free account included.
 */
export default async function SourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requirePracticeView(slug);
  redirect(`/dashboard/${slug}/competitors#sources`);
}
