/**
 * CabinetPage — personal dashboard: profile + stats
 * Route: /cabinet
 */

import CabinetLayout from '../components/cabinet/CabinetLayout';
import ProfileForm from '../components/cabinet/ProfileForm';
import CabinetStats from '../components/cabinet/CabinetStats';
import QuotaDisplay from '../components/cabinet/QuotaDisplay';
import PhoneVerification from '../components/cabinet/PhoneVerification';
import { useAuth } from '../context/AuthContext';

export default function CabinetPage() {
  const { user } = useAuth();

  return (
    <CabinetLayout title="Přehled">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <QuotaDisplay />
        <CabinetStats />
        <PhoneVerification
          currentPhone={user?.phone}
          phoneVerified={user?.phone_verified}
        />
        <ProfileForm />
      </div>
    </CabinetLayout>
  );
}
