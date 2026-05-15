"use client";

import { useState } from 'react';

export default function EditVocalistProfile() {
  const [profile, setProfile] = useState({
    artist_name: '',
    country: '',
    languages: [] as string[],
    genres: [] as string[],
    gender: '',
    vocal_range: '',
    voice_tags: [] as string[],
    vibe_tags: [] as string[],
    studio_quality: false,
    price: '',
    delivery_time: '',
    bio: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: save vocalist profile to Supabase
    alert('Profile saved (stub)');
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Edit Vocalist Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Artist Name</label>
          <input
            type="text"
            value={profile.artist_name}
            onChange={(e) => setProfile({ ...profile, artist_name: e.target.value })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Country</label>
          <input
            type="text"
            value={profile.country}
            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Languages</label>
          <input
            type="text"
            placeholder="Comma-separated, e.g. English, French"
            value={profile.languages.join(', ')}
            onChange={(e) => setProfile({ ...profile, languages: e.target.value.split(/,\s*/) })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Genres</label>
          <input
            type="text"
            placeholder="Comma-separated, e.g. Pop, House"
            value={profile.genres.join(', ')}
            onChange={(e) => setProfile({ ...profile, genres: e.target.value.split(/,\s*/) })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Gender</label>
            <select
              value={profile.gender}
              onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
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
              value={profile.vocal_range}
              onChange={(e) => setProfile({ ...profile, vocal_range: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            >
              <option value="">Select range</option>
              <option value="Low">Low</option>
              <option value="Mid">Mid</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>
        {/* For simplicity, voice_tags and vibe_tags are comma-separated inputs */}
        <div>
          <label className="block mb-1">Voice Tags</label>
          <input
            type="text"
            placeholder="Comma-separated, e.g. Warm, Soulful"
            value={profile.voice_tags.join(', ')}
            onChange={(e) => setProfile({ ...profile, voice_tags: e.target.value.split(/,\s*/) })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Vibe Tags</label>
          <input
            type="text"
            placeholder="Comma-separated, e.g. Dark, Energetic"
            value={profile.vibe_tags.join(', ')}
            onChange={(e) => setProfile({ ...profile, vibe_tags: e.target.value.split(/,\s*/) })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          />
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={profile.studio_quality}
            onChange={(e) => setProfile({ ...profile, studio_quality: e.target.checked })}
          />
          <label>Studio Quality</label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Price (USD)</label>
            <input
              type="number"
              value={profile.price}
              onChange={(e) => setProfile({ ...profile, price: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            />
          </div>
          <div>
            <label className="block mb-1">Delivery Time (days)</label>
            <input
              type="number"
              value={profile.delivery_time}
              onChange={(e) => setProfile({ ...profile, delivery_time: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            />
          </div>
        </div>
        <div>
          <label className="block mb-1">Bio</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            rows={4}
          />
        </div>
        <button
          type="submit"
          className="bg-primary hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded"
        >
          Save Profile
        </button>
      </form>
    </div>
  );
}