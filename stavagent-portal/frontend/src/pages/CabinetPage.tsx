/**
 * CabinetPage — personal dashboard: profile + stats
 * Route: /cabinet
 */

import CabinetLayout from '../components/cabinet/CabinetLayout';
import ProfileForm from '../components/cabinet/ProfileForm';
import CabinetStats from '../components/cabinet/CabinetStats';

export default function CabinetPage() {
  return (
    <CabinetLayout title="Přehled">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <CabinetStats />
        <ProfileForm />
      </div>
    </CabinetLayout>
  );
}
