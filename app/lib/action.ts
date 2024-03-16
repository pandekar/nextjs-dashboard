'use server';

import { z } from "zod";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string()
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

const createInvoice = async (formData: FormData) => {
  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status')
  });

  // It's usually good practice to store monetary values in cents in your database
  // to eliminate JavaScript floating-point errors and ensure greater accuracy.
  const amountsInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountsInCents}, ${status}, ${date})
    `;
  } catch(error) {
    return { message: 'Database error: Failed to creata Invoice' };
  }

  // purge cached data on a specific_route, revalidatePath(specific_route)
  // clearing cache and trigger a new request to the server for the specific_route
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices')
}

// use zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

const updateInvoice = async (id: string, formData: FormData) => {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status')
  })

  const amountsInCents = amount * 100;

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountsInCents}, status=${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    return { message: 'Database error: fail to update invoice' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const deleteInvoice = async (id: string) => {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');

    return { message: 'Invoice Deleted' };
  } catch (error) {
    return { message: 'Database error: fail to delete invoice' };
  }
}

export { createInvoice, updateInvoice, deleteInvoice };
