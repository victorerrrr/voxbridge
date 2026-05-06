export default function VocalistDashboard() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Vocalist Dashboard</h1>
      <p className="mb-4">Manage your profile and review orders from producers.</p>
      <div className="space-x-4">
        <a
          href="/vocalist/profile/edit"
          className="bg-primary hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded"
        >
          Edit Profile
        </a>
        <a
          href="/vocalist/samples"
          className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
        >
          Upload Samples
        </a>
      </div>
      {/* TODO: list orders for vocalist */}
    </div>
  );
}