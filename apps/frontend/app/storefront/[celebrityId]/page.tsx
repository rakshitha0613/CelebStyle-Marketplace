import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ celebrityId: string }>;
};

export default async function StorefrontDetailRedirectPage({ params }: Props) {
  const { celebrityId } = await params;
  redirect(`/storefronts/${celebrityId}`);
}
