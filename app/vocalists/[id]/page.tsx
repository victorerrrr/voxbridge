import { VocalistProfileView } from "@/components/vocalist-profile-view";

interface VocalistPageProps {
  params: Promise<{ id: string }>;
}

export default async function VocalistPage({ params }: VocalistPageProps) {
  const { id } = await params;
  return <VocalistProfileView id={id} />;
}
