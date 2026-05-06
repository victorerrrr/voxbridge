export default function ProducerDashboard() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Producer Dashboard</h1>
      <p className="mb-4">Here you'll see your current AI vocal requests.</p>
      <a
        href="/request/new"
        className="inline-block bg-primary hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded"
      >
        New request
      </a>
      {/* TODO: list existing requests for this producer */}
    </div>
  );
}