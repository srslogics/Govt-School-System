import { ErpWorkspace } from '@/components/erp/workspace';
import './erp.css';

export const dynamic = 'force-dynamic';

export default async function ErpPage({
  searchParams,
}: {
  searchParams: Promise<{
    class?: string | string[];
    date?: string | string[];
  }>;
}) {
  const query = await searchParams;
  return (
    <ErpWorkspace
      initial={{
        classId:
          typeof query.class === 'string'
            ? query.class.slice(0, 64)
            : undefined,
        date:
          typeof query.date === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(query.date)
            ? query.date
            : undefined,
      }}
    />
  );
}
