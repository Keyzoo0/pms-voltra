"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { FormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InlineAddForm({
  action,
  placeholder,
  successMessage,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  placeholder: string;
  successMessage: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const [value, setValue] = useState("");

  useEffect(() => {
    if (state.ok) {
      setValue("");
      toast.success(successMessage);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex gap-2">
      <Input
        name="name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus />} Tambah
      </Button>
    </form>
  );
}
