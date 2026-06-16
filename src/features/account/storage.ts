import type { Address } from './types';

/**
 * Address persistence layer.
 *
 * Phase 1: localStorage, keyed per user id. Phase 2: moves to a Supabase
 * `addresses` table with RLS (`auth.uid() = addresses.user_id`). Consumers
 * already call into this module so swapping the implementation is a
 * one-file change.
 */

const STORAGE_KEY = (userId: string) => `addresses-${userId}`;

const safeRead = (userId: string): Address[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Address[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeWrite = (userId: string, addresses: Address[]): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(addresses));
};

export const listAddresses = (userId: string): Address[] => safeRead(userId);

export const upsertAddress = (userId: string, address: Address): Address[] => {
  const current = safeRead(userId);
  const index = current.findIndex((entry) => entry.id === address.id);
  const next = index === -1 ? [...current, address] : current.map((entry, i) => (i === index ? address : entry));
  safeWrite(userId, next);
  return next;
};

export const deleteAddress = (userId: string, addressId: string): Address[] => {
  const current = safeRead(userId);
  const next = current.filter((entry) => entry.id !== addressId);
  safeWrite(userId, next);
  return next;
};

export const generateAddressId = (): string =>
  `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const emptyAddress = (overrides: Partial<Address> = {}): Address => ({
  id: generateAddressId(),
  label: '',
  firstName: '',
  lastName: '',
  address1: '',
  address2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  phone: '',
  ...overrides,
});
