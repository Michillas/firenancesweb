import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-6xl font-black text-accent">404</p>
        <p className="text-lg">Esta página no existe</p>
        <Link href="/" className="btn btn-primary">
          Volver a FireNances
        </Link>
      </div>
    </div>
  );
}
