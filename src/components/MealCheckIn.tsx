import { useState } from 'react';
import { Alert, View } from 'react-native';

import { plannedMealCalories } from '@/lib/mealLog';
import { useT } from '@/lib/i18n';
import { clampSnackText, MAX_SNACK_WORDS, wordCount } from '@/lib/words';
import {
  useDeleteMealLog,
  useEstimateSnackCalories,
  useUpsertMealLog,
} from '@/services/menuApi';
import type { MealLog, RecipeRow } from '@/types/db';
import type { KosherLevel, PlannedMeal } from '@/types/plan';

import { MealCard } from './MealCard';
import { Text } from './Text';
import { Button, Chip, Field } from './ui';

interface MealCheckInProps {
  weekStart: string;
  date: string;
  meal: PlannedMeal;
  recipe: RecipeRow | undefined;
  kosherLevel: KosherLevel;
  log: MealLog | undefined;
  onOpenRecipe: (recipeId: string, portion: number) => void;
}

/** Whole calories from 0 to 5000. Empty and non-digits are rejected. */
function parseLoggedCalories(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value > 5000) return null;
  return value;
}

/**
 * Meal card plus a check-in: ate the plan, or logged different calories
 * (typed, or estimated from a short description).
 */
export function MealCheckIn(props: MealCheckInProps) {
  const t = useT();
  const planned = plannedMealCalories(props.meal);
  const upsert = useUpsertMealLog(props.weekStart);
  const remove = useDeleteMealLog(props.weekStart);
  const estimate = useEstimateSnackCalories();
  const [choosing, setChoosing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [note, setNote] = useState('');
  const [calories, setCalories] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [estimateFailed, setEstimateFailed] = useState(false);

  const footer =
    planned === null ? undefined : (
      <CheckInBody
        log={props.log}
        choosing={choosing}
        formOpen={formOpen}
        note={note}
        calories={calories}
        invalid={invalid}
        estimateFailed={estimateFailed}
        saving={upsert.isPending}
        estimating={estimate.isPending}
        failed={upsert.isError || remove.isError}
        onAteThis={() => {
          upsert.mutate(
            {
              loggedOn: props.date,
              slot: props.meal.slot,
              status: 'planned',
              calories: planned,
            },
            {
              onSuccess: () => {
                setChoosing(false);
                setFormOpen(false);
              },
            }
          );
        }}
        onOpenOther={() => {
          const other = props.log?.status === 'other' ? props.log : undefined;
          setNote(other?.note ?? '');
          setCalories(other ? String(other.calories) : '');
          setInvalid(false);
          setEstimateFailed(false);
          setFormOpen(true);
          setChoosing(true);
        }}
        onChange={() => {
          setFormOpen(false);
          setChoosing(true);
        }}
        onClear={() => {
          Alert.alert(t('checkIn.clear'), t('checkIn.clearConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('checkIn.clear'),
              style: 'destructive',
              onPress: () =>
                remove.mutate(
                  { loggedOn: props.date, slot: props.meal.slot },
                  {
                    onSuccess: () => {
                      setChoosing(false);
                      setFormOpen(false);
                    },
                  }
                ),
            },
          ]);
        }}
        onNote={(next) => {
          setNote(clampSnackText(next));
          setEstimateFailed(false);
        }}
        onCalories={setCalories}
        onEstimate={() => {
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
        }}
        onSave={() => {
          const value = parseLoggedCalories(calories);
          if (value === null) {
            setInvalid(true);
            return;
          }
          setInvalid(false);
          upsert.mutate(
            {
              loggedOn: props.date,
              slot: props.meal.slot,
              status: 'other',
              calories: value,
              note: note.trim() || undefined,
            },
            {
              onSuccess: () => {
                setChoosing(false);
                setFormOpen(false);
              },
            }
          );
        }}
        onCancelForm={() => {
          setFormOpen(false);
          if (props.log) setChoosing(false);
        }}
      />
    );

  return (
    <MealCard
      meal={props.meal}
      recipe={props.recipe}
      kosherLevel={props.kosherLevel}
      onOpenRecipe={props.onOpenRecipe}
      footer={footer}
    />
  );
}

function CheckInBody(props: {
  log: MealLog | undefined;
  choosing: boolean;
  formOpen: boolean;
  note: string;
  calories: string;
  invalid: boolean;
  estimateFailed: boolean;
  saving: boolean;
  estimating: boolean;
  failed: boolean;
  onAteThis: () => void;
  onOpenOther: () => void;
  onChange: () => void;
  onClear: () => void;
  onNote: (value: string) => void;
  onCalories: (value: string) => void;
  onEstimate: () => void;
  onSave: () => void;
  onCancelForm: () => void;
}) {
  const t = useT();

  let body;
  if (props.formOpen) {
    body = (
      <View className="gap-2">
        <Field
          label={t('checkIn.descriptionLabel')}
          value={props.note}
          onChangeText={props.onNote}
          multiline
          numberOfLines={3}
          style={{ minHeight: 88, textAlignVertical: 'top' }}
          hint={t('checkIn.wordCount', { count: wordCount(props.note), max: MAX_SNACK_WORDS })}
        />
        <Button
          label={t('checkIn.estimate')}
          icon="robot-outline"
          variant="secondary"
          onPress={props.onEstimate}
          loading={props.estimating}
          disabled={wordCount(props.note) === 0}
        />
        <Text className={`text-xs ${props.estimateFailed ? 'text-meat' : 'text-gray-500'}`}>
          {props.estimateFailed ? t('checkIn.estimateFailed') : t('checkIn.estimateHint')}
        </Text>
        <Field
          label={t('checkIn.caloriesLabel')}
          value={props.calories}
          onChangeText={props.onCalories}
          keyboardType="number-pad"
          maxLength={4}
          error={props.invalid}
          hint={props.invalid ? t('checkIn.invalidCalories') : undefined}
        />
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button label={t('common.cancel')} variant="secondary" onPress={props.onCancelForm} />
          </View>
          <View className="flex-1">
            <Button label={t('common.save')} onPress={props.onSave} loading={props.saving} />
          </View>
        </View>
      </View>
    );
  } else if (props.log && !props.choosing) {
    const summary =
      props.log.status === 'planned'
        ? t('checkIn.atePlanned', { kcal: props.log.calories })
        : props.log.note
          ? t('checkIn.ateOtherNote', { kcal: props.log.calories, note: props.log.note })
          : t('checkIn.ateOther', { kcal: props.log.calories });
    body = (
      <View className="gap-2">
        <Text className="text-sm font-semibold text-gray-800">{summary}</Text>
        <View className="flex-row gap-2">
          <Chip label={t('checkIn.change')} selected={false} onPress={props.onChange} />
          <Chip label={t('checkIn.clear')} selected={false} onPress={props.onClear} />
        </View>
      </View>
    );
  } else {
    body = (
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={t('checkIn.ateThis')}
          icon="check"
          selected={false}
          onPress={props.onAteThis}
        />
        <Chip
          label={t('checkIn.somethingElse')}
          icon="pencil-outline"
          selected={false}
          onPress={props.onOpenOther}
        />
      </View>
    );
  }

  return (
    <View className="gap-2">
      {body}
      {props.failed && <Text className="text-sm text-meat">{t('common.genericError')}</Text>}
    </View>
  );
}
