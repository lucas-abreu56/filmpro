import InterceptedModal from "./InterceptedModal";

export default async function InterceptedMoviePage(props: {
  params: Promise<{ tmdbId: string }>;
}) {
  const params = await props.params;
  const tmdbId = parseInt(params.tmdbId, 10);
  return <InterceptedModal tmdbId={tmdbId} />;
}
