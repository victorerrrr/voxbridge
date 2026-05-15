"use client";

import { useState } from 'react';

export default function UploadSamples() {
  const [files, setFiles] = useState<File[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: upload samples to Supabase Storage
    alert(`${files.length} sample(s) uploaded (stub)`);
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Upload Vocal Samples</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Select 3–5 audio files</label>
          <input
            type="file"
            accept="audio/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
          />
        </div>
        <button
          type="submit"
          className="bg-primary hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded"
        >
          Upload Samples
        </button>
      </form>
    </div>
  );
}