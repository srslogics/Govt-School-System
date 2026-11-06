import Link from 'next/link';
import { DemoAuthGate } from '@/components/demo-auth';
import { SchoolRecordsProvider } from '@/components/school-records';

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DemoAuthGate
      erpLink={
        <Link className="erp-preview-link" href="/erp">
          Open shared school operations
        </Link>
      }
    >
      <SchoolRecordsProvider>{children}</SchoolRecordsProvider>
    </DemoAuthGate>
  );
}
