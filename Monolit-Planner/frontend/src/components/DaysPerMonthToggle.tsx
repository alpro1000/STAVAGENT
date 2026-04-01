/**
 * DaysPerMonthToggle - Switch between 30 and 22 days/month
 */

import { CalendarDays } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useConfig } from '../hooks/useConfig';

export default function DaysPerMonthToggle() {
  const { daysPerMonth } = useAppContext();
  const { updateConfig } = useConfig();

  const handleToggle = (days: 30 | 22) => {
    updateConfig({ days_per_month_mode: days });
  };

  return (
    <div className="duration-toggle">
      <span className="toggle-icon"><CalendarDays size={14} /></span>
      <button
        className={daysPerMonth === 30 ? 'active' : ''}
        onClick={() => handleToggle(30)}
        title="Režim 30 dní/měsíc (nepřetržitá práce, víkendy)"
      >
        30 dní
      </button>
      <button
        className={daysPerMonth === 22 ? 'active' : ''}
        onClick={() => handleToggle(22)}
        title="Režim 22 dní/měsíc (pracovní dny, bez víkendů)"
      >
        22 dní
      </button>
    </div>
  );
}
