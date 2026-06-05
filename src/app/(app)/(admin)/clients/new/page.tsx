import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "../client-form";
import { createClient } from "../actions";

export const metadata: Metadata = { title: "Klien Baru" };

export default function NewClientPage() {
  return (
    <div>
      <PageHeader
        title="Klien Baru"
        description="Tambahkan data klien baru."
        backHref="/clients"
        backLabel="Daftar Klien"
      />
      <ClientForm mode="create" action={createClient} />
    </div>
  );
}
