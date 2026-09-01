import { SaleDetailView } from "@/components/sales/sale-detail-view";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SaleDetailPage({ params }: Props) {
  const { id } = await params;
  return <SaleDetailView saleId={id} />;
}
