
export default async function DashboardPage() {
  return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="grid w-full max-w-5xl gap-6 md:grid-cols-2">
          <div className="flex flex-col items-start gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Welcome to your Dashboard 👋
            </h1>
          </div>
        </div>
      </main>
    </div>
  );
}