import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';

import { ProfileForm } from '@/components/ProfileForm';
import { TargetSummary } from '@/components/TargetSummary';
import { Text } from '@/components/Text';
import { Button, Loading } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { buildProfileInput, profileToFormValues } from '@/lib/profileForm';
import type { ProfileFormValues } from '@/lib/profileForm';
import { todayLocal } from '@/lib/week';
import { useProfile, useSaveProfile } from '@/services/menuApi';
import type { Profile } from '@/types/db';

function SettingsEditor({ profile }: { profile: Profile }) {
  const t = useT();
  const [values, setValues] = useState<ProfileFormValues>(() => profileToFormValues(profile));
  const [showErrors, setShowErrors] = useState(false);
  const result = useMemo(
    () => buildProfileInput(values, todayLocal(), profile),
    [values, profile]
  );
  const save = useSaveProfile();

  const onSave = () => {
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    save.mutate(result.input, { onSuccess: () => router.back() });
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        <ProfileForm
          values={values}
          errors={showErrors && !result.ok ? result.errors : []}
          onChange={setValues}
        />
        <TargetSummary result={result} />
        {showErrors && !result.ok && (
          <Text className="text-center text-meat">{t('onboarding.invalid')}</Text>
        )}
        {save.isError && <Text className="text-center text-meat">{t('common.genericError')}</Text>}
        <Button label={t('common.save')} onPress={onSave} loading={save.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function SettingsScreen() {
  const { data: profile } = useProfile();
  return profile ? <SettingsEditor profile={profile} /> : <Loading />;
}
