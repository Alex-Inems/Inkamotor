import { MailingForm } from "@/components/email-marketing/mailing-form";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EmailMarketingMailingPage({ params }: Props) {
  const { id } = await params;
  return <MailingForm mailingId={id} />;
}
