import InterfazeEmbedHost from "@/components/InterfazeEmbedHost";

export const dynamic = "force-dynamic";

type Search = { locale?: string; theme?: string };

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { locale, theme } = await searchParams;
  return <InterfazeEmbedHost locale={locale} theme={theme} />;
}
