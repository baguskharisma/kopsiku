import { z } from 'zod';

export const loginSchema = z.object({
	phone: z.string().min(10).max(15),
	password: z.string().min(6).max(128),
	remember: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

// import { jwtDecode } from "jwt-decode";

// interface JwtPayload {
// 	sub: string;
// 	phone: string;
// 	role: string;
// 	iat?: number;
// 	exp?: number;
//   }
  
//   export function getUserRole(): string | null {
// 	try {
// 	  const token = localStorage.getItem("accessToken"); // pastikan key sesuai
// 	  if (!token) {
// 		console.warn("No accessToken in localStorage");
// 		return null;
// 	  }
  
// 	  const decoded = jwtDecode<JwtPayload>(token);
// 	  console.log("Decoded JWT in frontend:", decoded); // 👈 cek payload full
// 	  return decoded.role || null;
// 	} catch (error) {
// 	  console.error("Failed to decode JWT:", error);
// 	  return null;
// 	}
//   }
  
  
  
  

// export function hasRole(requiredRole: string): boolean {
//   const role = getUserRole();
//   return role === requiredRole;
// }

// export function hasAnyRole(roles: string[]): boolean {
//   const role = getUserRole();
//   return role ? roles.includes(role) : false;
// }
