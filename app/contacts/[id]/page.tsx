import { ContactDetail } from "@/components/contacts/contact-detail";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;
  return <ContactDetail contactId={decodeURIComponent(id)} />;
}
