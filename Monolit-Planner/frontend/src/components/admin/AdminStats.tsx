/**
 * Admin Statistics Component
 * Display overall system statistics
 */

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div style={{
      background: 'white',
      border: `2px solid ${color}`,
      borderRadius: '8px',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '32px',
        marginBottom: '8px'
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: '12px',
        color: '#718096',
        marginBottom: '8px'
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: color
      }}>
        {value}
      </div>
    </div>
  );
}

interface AdminStatsProps {
  stats: any;
  loading: boolean;
  onRefresh: () => void;
}

export default function AdminStats({ stats, loading, onRefresh }: AdminStatsProps) {
  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#718096' }}>
        Načítání statistik...
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#718096' }}>
        Statistiky nejsou dostupné
      </div>
    );
  }

  const { users, projects, recent_users } = stats;

  return (
    <div>
      {/* Main Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <StatCard
          title="Celkem uživatelů"
          value={users?.total || 0}
          icon="👥"
          color="#667eea"
        />
        <StatCard
          title="Admin uživatelé"
          value={users?.admins || 0}
          icon="👑"
          color="#f6ad55"
        />
        <StatCard
          title="Ověření email"
          value={users?.verified || 0}
          icon="✅"
          color="#48bb78"
        />
        <StatCard
          title="Celkem projektů"
          value={projects?.total || 0}
          icon="📁"
          color="#38b2ac"
        />
      </div>

      {/* Projects Info */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '32px'
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
          Informace o projektech
        </h3>

        <div style={{
          color: '#718096',
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          <p>
            ✨ <strong>VARIANT 1:</strong> Všechny projekty jsou nyní univerzální. Uživatelé popisují typ projektu v poli "Popis objektu" (most, budova, parkoviště, atd.).
          </p>
          <p style={{ marginTop: '12px', color: '#4a5568' }}>
            Celkem projektů: <strong style={{ color: '#667eea', fontSize: '18px' }}>{projects?.total || 0}</strong>
          </p>
        </div>
      </div>

      {/* Recent Users */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '20px'
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
          Nedávně registrovaní uživatelé
        </h3>

        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {recent_users && recent_users.length > 0 ? (
            recent_users.map((user: any) => (
              <div key={user.id} style={{
                padding: '12px',
                borderBottom: '1px solid #edf2f7',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px'
              }}>
                <div>
                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                    {user.name}
                  </div>
                  <div style={{ color: '#718096', fontSize: '12px' }}>
                    {user.email}
                  </div>
                </div>
                <div style={{
                  color: '#a0aec0',
                  fontSize: '12px',
                  textAlign: 'right'
                }}>
                  {new Date(user.created_at).toLocaleDateString('cs-CZ')}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: '#718096', padding: '20px', textAlign: 'center' }}>
              Žádní uživatelé
            </div>
          )}
        </div>
      </div>

      {/* Refresh Button */}
      <div style={{
        marginTop: '24px',
        textAlign: 'center'
      }}>
        <button
          onClick={onRefresh}
          style={{
            padding: '10px 20px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#5a67d8';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#667eea';
          }}
        >
          🔄 Obnovit
        </button>
      </div>
    </div>
  );
}
