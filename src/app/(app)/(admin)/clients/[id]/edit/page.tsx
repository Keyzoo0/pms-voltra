import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "../../client-form";
import { updateClient } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit Klien" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client) notFound();

  const action = updateClient.bind(null, client.id);

  return (
    <div>
      <PageHeader
        title="Edit Klien"
        description={client.name}
        backHref={`/clients/${client.id}`}
        backLabel="Detail Klien"
      />
      <ClientForm
        mode="edit"
        action={action}
        client={{
          name: client.name,
          picName: client.picName,
          contact: client.contact,
          address: client.address,
          notes: client.notes,
        }}
      />
    </div>
  );
}
