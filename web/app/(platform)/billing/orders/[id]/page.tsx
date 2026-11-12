import { BillingOrder } from '@/components/Billing';
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BillingOrder orderId={id} />;
}
