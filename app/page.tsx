import { redirect } from 'next/navigation';
import { sharedErpAvailable } from '@/lib/erp/runtime';

export const dynamic = 'force-dynamic';

export default function Home() {
  redirect(sharedErpAvailable ? '/erp' : '/preview');
}
