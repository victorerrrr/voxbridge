"use client";

import { useState } from 'react';

interface Params {
  id: string;
}

export default function OrderDetail({ params }: { params: Params }) {
  const { id } = params;
  // TODO: fetch order details based on ID
  const [status, setStatus] = useState<'pending' | 'paid' | 'in_progress' | 'delivered' | 'approved'>('pending');
  const [finalVocal, setFinalVocal] = useState<File | null>(null);
  const [harmonies, setHarmonies] = useState<File | null>(null);
  const [adlibs, setAdlibs] = useState<File | null>(null);

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: upload files to Supabase Storage and update order
    setStatus('delivered');
    alert('Files uploaded (stub)');
  };

  const handleApprove = () => {
    // TODO: mark order as approved
    setStatus('approved');
    alert('Order approved (stub)');
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Order Details</h1>
      <p className="mb-2">Order ID: {id}</p>
      <p className="mb-4">Status: {status}</p>
      {status === 'pending' && (
        <p className="mb-4">Waiting for payment…</p>
      )}
      {status === 'paid' && (
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block mb-1">Final Vocal (WAV)</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setFinalVocal(e.target.files?.[0] || null)}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            />
          </div>
          <div>
            <label className="block mb-1">Harmonies (optional)</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setHarmonies(e.target.files?.[0] || null)}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            />
          </div>
          <div>
            <label className="block mb-1">Adlibs (optional)</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAdlibs(e.target.files?.[0] || null)}
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            />
          </div>
          <button
            type="submit"
            className="bg-primary hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded"
          >
            Upload Files
          </button>
        </form>
      )}
      {status === 'delivered' && (
        <div className="space-y-4">
          <p className="mb-2">Files uploaded. Waiting for producer approval…</p>
          {/* TODO: show download links to producer */}
          <button
            onClick={handleApprove}
            className="bg-primary hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded"
          >
            Approve Order
          </button>
        </div>
      )}
      {status === 'approved' && <p className="mb-2">Order completed.</p>}
    </div>
  );
}