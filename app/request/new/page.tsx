import { useState } from 'react';

export default function NewRequestPage() {
  // For now we simply manage local state and do nothing on submit.
  const [form, setForm] = useState({
    title: '',
    ai_vocal_file: undefined as File | undefined,
    instrumental_file: undefined as File | undefined,
    lyrics: '',
    bpm: '',
    key: '',
    genre: '',
    language: '',
    gender: '',
    vocal_range: '',
    voice_tags: [] as string[],
    vibe_tags: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: handle submit to Supabase
    alert('Request submitted (stub)');
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">New AI Vocal Request</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">AI Vocal File</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setForm({ ...form, ai_vocal_file: e.target.files?.[0] })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Instrumental File</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setForm({ ...form, instrumental_file: e.target.files?.[0] })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Lyrics</label>
          <textarea
            value={form.lyrics}
            onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            rows={4}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">BPM</label>
            <input
              type="number"
              value={form.bpm}
              onChange={(e) => setForm({ ...form, bpm: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            />
          </div>
          <div>
            <label className="block mb-1">Key</label>
            <input
              type="text"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            />
          </div>
        </div>
        <div>
          <label className="block mb-1">Genre</label>
          <select
            value={form.genre}
            onChange={(e) => setForm({ ...form, genre: e.target.value })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          >
            <option value="">Select genre</option>
            <option value="Afro House">Afro House</option>
            <option value="Pop">Pop</option>
            <option value="EDM">EDM</option>
            <option value="House">House</option>
            <option value="Cinematic">Cinematic</option>
          </select>
        </div>
        <div>
          <label className="block mb-1">Language</label>
          <select
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          >
            <option value="">Select language</option>
            <option value="English">English</option>
            <option value="Portuguese">Portuguese</option>
            <option value="French">French</option>
            <option value="Serbian">Serbian</option>
            <option value="Spanish">Spanish</option>
            <option value="Hebrew">Hebrew</option>
            <option value="Russian">Russian</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Gender</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            >
              <option value="">Select gender</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </div>
          <div>
            <label className="block mb-1">Vocal Range</label>
            <select
              value={form.vocal_range}
              onChange={(e) => setForm({ ...form, vocal_range: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            >
              <option value="">Select range</option>
              <option value="Low">Low</option>
              <option value="Mid">Mid</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>
        {/* TODO: multi-select fields for voice_tags and vibe_tags */}
        <button
          type="submit"
          className="bg-primary hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded"
        >
          Submit Request
        </button>
      </form>
    </div>
  );
}