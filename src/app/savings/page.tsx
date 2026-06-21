import { redirect } from "next/navigation";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { SavingsPageClient } from "../_components/savings-page-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Savings" };

export default async function SavingsPage() {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Savings</h2>
      </div>

      <SavingsPageClient companyId={userCompany.companyId} />
    </div>
  );
}
