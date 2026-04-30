import type { ComponentType, ReactNode } from 'react';
import { Tategumi } from './Tategumi';

export const TEMPLATES: Record<string, ComponentType<{ children: ReactNode }>> = {
  tategumi: Tategumi,
};

export function resolveTemplate(name: unknown): ComponentType<{ children: ReactNode }> | null {
  if (typeof name !== 'string') return null;
  return TEMPLATES[name] ?? null;
}
