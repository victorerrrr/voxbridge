import { useSearchParams } from 'next/navigation';

export default function CreateOrder() {
  const params = useSearchParams();
  const requestId = params.get('request_id');
  const vocalistId = params.get('vocalist_id');
  // TODO: fetch price and details based on request and vocalist
  const price = 100;
  const artistName = 'Sample Vocalist';
  const deliveryTime = 7;

  const handlePay = () => {
    // TODO: integrate Stripe checkout
    alert('Payment flow to Stripe (stub)');
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Create Order</h1>
      <p className="mb-2">Request ID: {requestId}</p>
      <p className="mb-2">Vocalist ID: {vocalistId}</p>
      <p className="mb-2">Vocalist: {artistName}</p>
      <p className="mb-2">Price: ${price}</p>
      <p className="mb-4">Estimated Delivery: {deliveryTime} days</p>
      <button
        onClick={handlePay}
        className="bg-primary hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded"
      >
        Pay with Stripe
      </button>
    </div>
  );
}