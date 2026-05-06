interface Params {
  id: string;
}

export default function VocalistProfile({ params }: { params: Params }) {
  const { id } = params;
  // TODO: fetch vocalist profile and samples from Supabase
  const profile = {
    artist_name: 'Sample Vocalist',
    tags: ['Female', 'Warm', 'Soulful'],
    price: 100,
    delivery_time: 7,
    samples: [
      {
        id: 'sample1',
        url: '',
      },
    ],
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">{profile.artist_name}</h1>
      <p className="mb-1">Tags: {profile.tags.join(', ')}</p>
      <p className="mb-1">Price: ${profile.price}</p>
      <p className="mb-4">Delivery: {profile.delivery_time} days</p>
      <h2 className="text-2xl font-semibold mb-2">Samples</h2>
      <div className="space-y-4">
        {profile.samples.map((sample) => (
          <div key={sample.id} className="bg-gray-800 p-4 rounded">
            <audio controls className="w-full">
              <source src={sample.url} />
              Your browser does not support the audio element.
            </audio>
          </div>
        ))}
      </div>
    </div>
  );
}