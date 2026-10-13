import { z } from 'zod';
const name = z.string().trim().min(1).max(200);
const notes = z.string().max(5000).nullable().optional();
const date = z.iso.date().nullable().optional();
export const tripInput = z.object({ name, startDate: date, endDate: date }).strict();
export const dayInput = z.object({ title: name.nullable().optional(), notes }).strict();
export const destinationInput = z
  .object({
    name,
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    notes,
  })
  .strict();
const nonempty = (value: object) => Object.keys(value).length > 0;
export const tripPatch = tripInput
  .partial()
  .refine(nonempty, 'Provide at least one field');
export const dayPatch = dayInput.refine(nonempty, 'Provide at least one field');
export const destinationPatch = destinationInput
  .partial()
  .refine(nonempty, 'Provide at least one field');
export const reorderInput = z.object({ ids: z.array(z.uuid()) }).strict();
