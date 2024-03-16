'use server';

import { z } from "zod";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type State = {
  errors?: {
    customerId?: Array<string>;
    amount?: Array<string>;
    status?: Array<string>;
  };
  message?: string | null;
}

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.'
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greate than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.'
  }),
  date: z.string()
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

const createInvoice = async (prevState: State, formData: FormData) => {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status')
  });

  // if form validations fails, return errors early. Otherwise continue
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to create invoice.',
    }
  }

  // It's usually good practice to store monetary values in cents in your database
  // to eliminate JavaScript floating-point errors and ensure greater accuracy.
  const { customerId, amount, status } = validatedFields.data;
  const amountsInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  // Insert data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountsInCents}, ${status}, ${date})
    `;
  } catch(error) {
    // if a database error occurs, return a more specific error
    return { message: 'Database error: Failed to creata Invoice' };
  }

  // Revalidate the cache for the invoices page and redirect the user.
  // purge cached data on a specific_route, revalidatePath(specific_route)
  // clearing cache and trigger a new request to the server for the specific_route
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices')
}

// use zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

const updateInvoice = async (id: string, prevState: State, formData: FormData) => {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status')
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    }
  }

  const { customerId, amount, status } = validatedFields.data;
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
