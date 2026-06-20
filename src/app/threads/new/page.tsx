import { redirect } from "next/navigation";
import { getUserCompany } from "@/adapters/supabase/auth/get-user-company";
import { NewThreadForm } from "@/app/_components/new-thread-form";

export const dynamic = "force-dynamic";

export default async function NewThreadPage() {
  const userCompany = await getUserCompany();
  if (!userCompany) redirect("/onboarding");

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-xl font-bold">New Thread</h2>
      <NewThreadForm companyId={userCompany.companyId} />
    </div>
  );
}
