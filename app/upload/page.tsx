"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const [fileName, setFileName] = useState("");
  const router = useRouter();

  const handleFileChange = (e: any) => {
    const file = e.target.files[0];
    if (file) setFileName(file.name);
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    router.push("/matches");
  };

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Upload AI Vocal</h1>

      <form onSubmit={handleSubmit} className="max-w-xl flex flex-col gap-4">
        <input className="p-3 rounded text-black" placeholder="Track title" />
        <input className="p-3 rounded" type="file" accept="audio/*" onChange={handleFileChange} />

        <p className="text-gray-400">
          {fileName ? "Selected: " + fileName : "No file selected"}
        </p>

        <textarea className="p-3 rounded text-black" placeholder="Lyrics" />
        <input className="p-3 rounded text-black" placeholder="BPM" />
        <input className="p-3 rounded text-black" placeholder="Key" />

        <button className="bg-purple-600 px-6 py-3 rounded-xl">
          Find matching voices
        </button>
      </form>
    </main>
  );
}