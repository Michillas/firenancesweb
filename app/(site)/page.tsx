import { LandingPage } from "@/features/landing/landing-page";
import { publicPage } from "@/lib/seo";

export const metadata = publicPage({ path: "/" });

export default function Page() {
  return <LandingPage />;
}
