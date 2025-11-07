/**
 * DaysPerMonthToggle - Switch between 30 and 22 days/month
 */


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
      <span style={{ fontSize: '16px' }}>📅</span>
      <button
        className={daysPerMonth === 30 ? 'active' : ''}
        onClick={() => handleToggle(30)}
      >
        30 dní
      </button>
      <button
        className={daysPerMonth === 22 ? 'active' : ''}
        onClick={() => handleToggle(22)}
      >
        22 dní
      </button>
    </div>
  );
}
