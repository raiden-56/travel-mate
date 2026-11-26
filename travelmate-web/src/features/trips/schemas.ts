import { z } from "zod";
import { TRAVEL_STYLES } from "@/types/api";
import { daysBetweenInclusive } from "@/lib/dates";

const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 20000 or 20000.50");

// Mirrors TripUpsert validation on the backend.
export const tripFormSchema = z
  .object({
    name: z.string().trim().min(2, "Give your trip a name").max(120),
    destinationSlug: z.string().optional(),
    destinationName: z.string().trim().min(2, "Where are you going?").max(120),
    startLocation: z.string().trim().max(120).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    dayCount: z.coerce.number().int().min(1, "At least 1 day").max(60, "At most 60 days"),
    travelers: z.coerce.number().int().min(1, "At least 1 traveler").max(50, "At most 50 travelers"),
    tripType: z.enum(TRAVEL_STYLES).optional().or(z.literal("")),
    budgetAmount: moneyString.optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate) {
      if (v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date is before the start date" });
      else if (daysBetweenInclusive(v.startDate, v.endDate) > 60)
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "Trips can be at most 60 days" });
    }
    if (v.endDate && !v.startDate) ctx.addIssue({ code: "custom", path: ["startDate"], message: "Add a start date too" });
  });

export type TripFormValues = z.input<typeof tripFormSchema>;
export type TripFormOutput = z.output<typeof tripFormSchema>;
