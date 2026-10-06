import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/Text';
import { Button, Card, Chip, EmptyState, Field, SectionTitle } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import { localDateOf, localTimeOf, weekdayOf, weekStartFor } from '@/lib/week';
import { clampSnackText, MAX_SNACK_WORDS, wordCount } from '@/lib/words';
import {
  useAddCheatLog,
  useCheatLogs,
  useDeleteCheatLog,
  useEstimateSnackCalories,
  useProfile,
  useWeeklyPlan,
} from '@/services/menuApi';
import type { CheatKind } from '@/types/db';

const KINDS: CheatKind[] = ['beer', 'sweet', 'other'];
const DEFAULT_CALORIES: Record<CheatKind, number> = { beer: 150, sweet: 250, other: 200 };

export default function BankScreen() {
  const t = useT();
  const weekStart = weekStartFor(0);
  const { data: profile } = useProfile();
  const { data: saved } = useWeeklyPlan(weekStart);
  const logsQuery = useCheatLogs(weekStart);
  const addLog = useAddCheatLog(weekStart);
  const deleteLog = useDeleteCheatLog(weekStart);
  const estimate = useEstimateSnackCalories();

  const [kind, setKind] = useState<CheatKind>('beer');
  const [calories, setCalories] = useState(String(DEFAULT_CALORIES.beer));
  const [note, setNote] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [estimateFailed, setEstimateFailed] = useState(false);

  // The week's plan holds the budget it was built with; fall back to the profile.
  const budget = saved?.plan.weekly_cheat_bank ?? profile?.weekly_cheat_bank ?? 0;
  const logs = logsQuery.data ?? [];
  const spent = logs.reduce((sum, log) => sum + log.calories, 0);
  const remaining = budget - spent;
  const usedShare = budget > 0 ? Math.min(1, spent / budget) : spent > 0 ? 1 : 0;

  const selectKind = (next: CheatKind) => {
    setKind(next);
    // Other keeps an estimate already filled from the description. Beer and sweet use their defaults.
    if (next !== 'other' || wordCount(note) === 0) setCalories(String(DEFAULT_CALORIES[next]));
    if (next !== 'other') setEstimateFailed(false);
    setInvalid(false);
  };

  const onEstimate = () => {
    const description = note.trim();
    if (wordCount(description) === 0) return;
    setEstimateFailed(false);
    estimate.mutate(description, {
      onSuccess: (kcal) => {
        setCalories(String(kcal));
        setInvalid(false);
      },
      onError: () => setEstimateFailed(true),
    });
  };

  const onAdd = () => {
    const value = Number(calories.trim());
    if (!Number.isInteger(value) || value < 1 || value > 5000) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    addLog.mutate(
      { kind, calories: value, note: kind === 'other' ? note.trim() || undefined : undefined },
      { onSuccess: () => setNote('') }
    );
  };

  const confirmDelete = (id: string) =>
    Alert.alert(t('common.delete'), t('bank.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteLog.mutate(id) },
    ]);

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <ScrollView contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        <Card className="gap-3">
          <View className="flex-row items-center gap-3">
            <View
              className={`h-12 w-12 items-center justify-center rounded-full ${remaining < 0 ? 'bg-red-50' : 'bg-brand-100'}`}
            >
              <MaterialCommunityIcons
                name="cupcake"
                size={26}
                color={remaining < 0 ? COLORS.meat : COLORS.brandDark}
              />
            </View>
            <Text
              className={`flex-1 text-xl font-bold ${remaining < 0 ? 'text-meat' : 'text-brand-600'}`}
            >
              {remaining < 0
                ? t('bank.over', { over: -remaining })
                : t('bank.remaining', { remaining })}
            </Text>
          </View>
          <View className="h-3 overflow-hidden rounded-full bg-brand-100">
            <View
              className={`h-3 rounded-full ${remaining < 0 ? 'bg-meat' : 'bg-brand-500'}`}
              style={{ width: `${usedShare * 100}%` }}
            />
          </View>
          <Text className="text-sm text-gray-600">{t('bank.budget', { budget })}</Text>
        </Card>

        <Card className="gap-3">
          <View className="flex-row gap-2">
            {KINDS.map((k) => (
              <Chip
                key={k}
                label={t(`bank.kinds.${k}`)}
                icon={k === 'other' ? 'robot-outline' : undefined}
                selected={kind === k}
                onPress={() => selectKind(k)}
              />
            ))}
          </View>
          {kind === 'other' && (
            <>
              <Field
                label={t('bank.descriptionLabel')}
                value={note}
                onChangeText={(next) => {
                  setNote(clampSnackText(next));
                  setEstimateFailed(false);
                }}
                multiline
                numberOfLines={3}
                style={{ minHeight: 88, textAlignVertical: 'top' }}
                hint={t('bank.wordCount', { count: wordCount(note), max: MAX_SNACK_WORDS })}
              />
              <Button
                label={t('bank.estimate')}
                icon="robot-outline"
                variant="secondary"
                onPress={onEstimate}
                loading={estimate.isPending}
                disabled={wordCount(note) === 0}
              />
              <Text className={`text-xs ${estimateFailed ? 'text-meat' : 'text-gray-500'}`}>
                {estimateFailed ? t('bank.estimateFailed') : t('bank.estimateHint')}
              </Text>
            </>
          )}
          <Field
            label={t('bank.caloriesLabel')}
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
            maxLength={4}
            error={invalid}
            hint={invalid ? t('bank.invalidCalories') : undefined}
          />
          <Button label={t('bank.add')} onPress={onAdd} loading={addLog.isPending} />
          {(addLog.isError || deleteLog.isError) && (
            <Text className="text-center text-meat">{t('common.genericError')}</Text>
          )}
        </Card>

        <Card>
          <SectionTitle>{t('bank.history')}</SectionTitle>
          {logs.length === 0 ? (
            <EmptyState icon="star-four-points" message={t('bank.empty')} />
          ) : (
            logs.map((log) => (
              <View key={log.id} className="flex-row items-center gap-3 border-b border-gray-100 py-2">
                <View className="flex-1">
                  <Text className="text-base text-gray-900">
                    {t(`bank.kinds.${log.kind}`)} · {log.calories} {t('common.kcal')}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {t(`weekdaysShort.${weekdayOf(localDateOf(log.logged_at))}`)}{' '}
                    {localTimeOf(log.logged_at)}
                    {log.note ? ` · ${log.note}` : ''}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  onPress={() => confirmDelete(log.id)}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color="#6b7280" />
                </Pressable>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
