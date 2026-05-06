interface Params {
  id: string;
}

export default function MatchesPage({ params }: { params: Params }) {
  const { id } = params;
  // TODO: fetch matching vocalists from Supabase based on this request ID.
  const sampleMatches = [
    {
      id: 'vocalist-1',
      artist_name: 'Sample Vocalist',
      match: 85,
      tags: ['Female', 'Warm', 'Soulful'],
      price: 100,
      delivery_time: 7,
    },
  ];

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Matching Vocalists</h1>
      <p className="mb-4">Request ID: {id}</p>
      <div className="space-y-4">
        {sampleMatches.map((match) => (
          <div
            key={match.id}
            className="p-4 border border-gray-700 rounded bg-gray-800"
          >
            <h2 className="text-xl font-semibold">{match.artist_name}</h2>
            <p className="text-sm mb-1">Match: {match.match}%</p>
            <p className="text-sm mb-1">Tags: {match.tags.join(', ')}</p>
            <p className="text-sm mb-1">Price: ${match.price}</p>
            <p className="text-sm mb-3">Delivery: {match.delivery_time} days</p>
            <a
              href={`/order/create?request_id=${id}&vocalist_id=${match.id}`}
              className="bg-primary hover:bg-purple-700 text-white font-semibold py-2 px-3 rounded"
            >
              Order
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}