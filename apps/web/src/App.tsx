export default function App() {
  return (
    <div className="min-h-screen bg-ivory text-charcoal">
      <header className="border-b-4 border-terracotta">
        <div className="mx-auto flex w-full max-w-5xl items-baseline px-6 py-5">
          <p className="font-serif text-2xl tracking-tight">EverTold</p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16">
        <h1 className="max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">
          Every story deserves to live on.
        </h1>
        <p className="max-w-2xl border-l-4 border-sage pl-4 text-lg leading-relaxed">
          The EverTold foundation is in place. Recording, transcription, and
          story organization are not available yet.
        </p>
      </main>
    </div>
  );
}
