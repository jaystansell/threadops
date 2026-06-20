export type CompanyId = string & { readonly __brand: "CompanyId" };

export interface Company {
  id: CompanyId;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: CompanyId;
  user_id: string;
  role: CompanyMemberRole;
  created_at: string;
}

export type CompanyMemberRole = "owner" | "admin" | "member";
