import Link from "next/link";
export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-6">
        VoxBridge
      </h1>

      <p className="mb-8 text-lg text-gray-400">
        Turn AI vocals into real voices
      </p>

      <div className="flex gap-4">
       <Link href="/upload">
  <button className="bg-purple-600 px-6 py-3 rounded-xl">
    Upload AI Vocal
  </button>
</Link>

        <button className="border border-white px-6 py-3 rounded-xl">
          Join as Vocalist
        </button>
      </div>
    </main>
  );
}