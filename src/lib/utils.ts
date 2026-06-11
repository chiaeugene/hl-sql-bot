import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn-style class combiner: merges conditional classes and resolves
// conflicting Tailwind utilities (last one wins).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
