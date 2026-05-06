export default function MatchesPage() {
  const vocalists = [
    {
      name: "Anna Voice",
      match: 92,
      genre: "House",
      price: "$150",
    },
    {
      name: "Luna Sky",
      match: 87,
      genre: "Pop",
      price: "$120",
    },
    {
      name: "Mike Soul",
      match: 78,
      genre: "EDM",
      price: "$100",
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Matching Vocalists</h1>

      <div className="flex flex-col gap-4">
        {vocalists.map((v, i) => (
          <div key={i} className="border p-4 rounded-xl">
            <h2 className="text-xl">{v.name}</h2>
            <p>Match: {v.match}%</p>
            <p>Genre: {v.genre}</p>
            <p>Price: {v.price}</p>
          </div>
        ))}
      </div>
    </main>
  );
}