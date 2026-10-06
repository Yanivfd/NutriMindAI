import { useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, View } from 'react-native';

import { LanguageToggle } from '@/components/LanguageToggle';
import { Text } from '@/components/Text';
import { Button, Field, SafeScreen } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { sendEmailCode, verifyEmailCode } from '@/services/auth';
import { reportError } from '@/services/errorLog';

const appIcon = require('../../assets/icon.png');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

type Step = { kind: 'email' } | { kind: 'code'; email: string };

export default function LoginScreen() {
  const t = useT();
  const [step, setStep] = useState<Step>({ kind: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSendCode = async () => {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendEmailCode(normalized);
      setCode('');
      setStep({ kind: 'code', email: normalized });
    } catch (error: unknown) {
      reportError(error, { source: 'auth', where: 'send-code' });
      const detail = __DEV__ && error instanceof Error ? error.message : null;
      setError(detail ? `${t('auth.sendFailed')} (${detail})` : t('auth.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  // On success the auth listener updates state and the root navigator leaves this screen.
  const onVerify = async (targetEmail: string) => {
    if (!CODE_RE.test(code.trim())) {
      setError(t('auth.invalidCode'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(targetEmail, code.trim());
    } catch (error: unknown) {
      reportError(error, { source: 'auth', where: 'verify-code' });
      setError(t('auth.invalidCode'));
      setBusy(false);
    }
  };

  return (
    <SafeScreen>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-6 p-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-3">
            <Image
              source={appIcon}
              accessibilityIgnoresInvertColors
              style={{ width: 96, height: 96, borderRadius: 28 }}
            />
            <Text className="text-3xl font-bold text-gray-900">{t('auth.title')}</Text>
            <Text className="text-center text-base text-gray-600">{t('auth.subtitle')}</Text>
          </View>

          {step.kind === 'email' ? (
            <View className="gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <Field
                label={t('auth.emailLabel')}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                onSubmitEditing={onSendCode}
              />
              <Button label={t('auth.sendCode')} onPress={onSendCode} loading={busy} />
            </View>
          ) : (
            <View className="gap-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <Text className="text-center text-base text-gray-700">
                {t('auth.codeSent', { destination: step.email })}
              </Text>
              <Field
                label={t('auth.codeLabel')}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                onSubmitEditing={() => onVerify(step.email)}
              />
              <Button label={t('auth.verify')} onPress={() => onVerify(step.email)} loading={busy} />
              <Button
                label={t('auth.changeContact')}
                variant="secondary"
                onPress={() => {
                  setError(null);
                  setStep({ kind: 'email' });
                }}
                disabled={busy}
              />
            </View>
          )}

          {error && <Text className="text-center text-meat">{error}</Text>}

          <LanguageToggle />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
