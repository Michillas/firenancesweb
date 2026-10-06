import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-6xl font-black text-accent">404</p>
        <h1 className="text-lg">Esta página no existe</h1>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="btn btn-primary">
            Ir a mi panel
          </Link>
          <Link href="/" className="btn btn-secondary">
            Página principal
          </Link>
        </div>
      </div>
    </div>
  );
}
