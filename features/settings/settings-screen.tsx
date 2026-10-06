"use client";

import { PageHeader } from "@/components/ui";
import { AiSection } from "./ai-section";
import { AppearanceSection } from "./appearance-section";
import { CategoriesSection } from "./categories-section";
import { DataSection } from "./data-section";
import { ProfileSection } from "./profile-section";

export function SettingsScreen() {
  return (
    <>
      <PageHeader title="Ajustes" description="Tu perfil, la IA, las categorías y tus datos." />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <ProfileSection />
        <AiSection />
        <div className="lg:col-span-2">
          <CategoriesSection />
        </div>
        <AppearanceSection />
        <DataSection />
      </div>
    </>
  );
}
