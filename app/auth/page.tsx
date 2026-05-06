export default function AuthPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Sign up / Sign in</h1>
      <p className="mb-4">
        This page will integrate Supabase Auth for user registration and login. After signing in for the first
        time, users will choose whether they are a producer or a vocalist.
      </p>
      {/* TODO: implement Supabase Auth UI here */}
    </div>
  );
}