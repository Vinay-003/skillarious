import { useParams } from 'next/navigation';

/** Dynamic app routes always provide these params; fail visibly if routing is broken. */
export function useRequiredParams<T extends Record<string, string>>(): T {
  const params = useParams<T>();
  if (!params) throw new Error('This page requires a dynamic route.');
  return params;
}
