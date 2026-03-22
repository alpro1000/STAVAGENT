/**
 * Phone Verification Component
 * Used in cabinet/profile to verify phone number via SMS code
 */

import { useState } from 'react';
import { phoneAPI } from '../../services/api';

interface PhoneVerificationProps {
  currentPhone?: string | null;
  phoneVerified?: boolean;
  onVerified?: (phone: string) => void;
}

export default function PhoneVerification({ currentPhone, phoneVerified, onVerified }: PhoneVerificationProps) {
  const [phone, setPhone] = useState(currentPhone || '+420');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [devCode, setDevCode] = useState('');

  const sendCode = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await phoneAPI.sendCode(phone);
      setStep('verify');
      setSuccess('Kod odeslan na ' + phone);
      if (res.dev_code) setDevCode(res.dev_code); // dev mode only
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Chyba pri odesilani kodu');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    try {
      setLoading(true);
      setError('');
      await phoneAPI.verifyCode(code);
      setSuccess('Telefon uspesne overen!');
      setStep('input');
      onVerified?.(phone);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Neplatny kod');
    } finally {
      setLoading(false);
    }
  };

  if (phoneVerified && currentPhone) {
    return (
      <div style={{
        padding: 12, background: '#f0fff4', border: '1px solid #c6f6d5',
        borderRadius: 8, fontSize: 13,
      }}>
        <span style={{ color: '#22543d', fontWeight: 500 }}>
          Telefon overen: {currentPhone}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      padding: 16, background: '#fffbeb', border: '1px solid #fde68a',
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Overeni telefonu
      </div>
      <div style={{ fontSize: 12, color: '#92400e', marginBottom: 12 }}>
        Overeny telefon zvysuje bezpecnost uctu a umoznuje plne vyuziti sluzby.
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#e53e3e', marginBottom: 8 }}>{error}</div>
      )}
      {success && (
        <div style={{ fontSize: 12, color: '#38a169', marginBottom: 8 }}>{success}</div>
      )}

      {step === 'input' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+420XXXXXXXXX"
            style={{
              flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0',
              borderRadius: 6, fontSize: 14,
            }}
          />
          <button
            onClick={sendCode}
            disabled={loading || phone.length < 12}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 6,
              background: '#FF9F1C', color: '#fff', cursor: 'pointer',
              fontWeight: 600, fontSize: 13, opacity: loading ? 0.6 : 1,
            }}
          >{loading ? 'Odesila se...' : 'Odeslat kod'}</button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-mistny kod"
              maxLength={6}
              style={{
                flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0',
                borderRadius: 6, fontSize: 18, letterSpacing: 4, textAlign: 'center',
              }}
            />
            <button
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 6,
                background: '#48bb78', color: '#fff', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, opacity: loading ? 0.6 : 1,
              }}
            >{loading ? 'Overuje se...' : 'Overit'}</button>
          </div>
          {devCode && (
            <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
              DEV kod: {devCode}
            </div>
          )}
          <button
            onClick={() => { setStep('input'); setCode(''); setDevCode(''); }}
            style={{
              border: 'none', background: 'none', color: '#FF9F1C',
              cursor: 'pointer', fontSize: 12, padding: 0, marginTop: 4,
            }}
          >Zmenit cislo</button>
        </div>
      )}
    </div>
  );
}
