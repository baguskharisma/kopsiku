import { z } from 'zod';

export const loginSchema = z.object({
	phone: z.string().min(10).max(15),
	password: z.string().min(6).max(128),
	remember: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;