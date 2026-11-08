import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { pickerQuery, replaceMealInPlan } from '@/lib/dishPicker';
import type { PickerDish } from '@/lib/dishPicker';
import { localizedTitle } from '@/lib/format';
import { plannedMealCalories } from '@/lib/mealLog';
import { useLanguage, useT } from '@/lib/i18n';
import { COLORS } from '@/lib/theme';
import { clampSnackText, MAX_SNACK_WORDS, wordCount } from '@/lib/words';
import {
  useDeleteMealLog,
  useEstimateSnackCalories,
  useReplacePlannedMeal,
  useUpsertMealLog,
} from '@/services/menuApi';
import type { MealLog, RecipeRow } from '@/types/db';
import type {
  Cuisine,
  DislikedIngredient,
  KosherLevel,
  PlannedMeal,
  Weekday,
  WeeklyPlanPayload,
} from '@/types/plan';

import { DishPicker } from './DishPicker';
import { MealCard } from './MealCard';
import { Text } from './Text';
import { Button, Chip, Field } from './ui';

interface MealCheckInProps {
  weekStart: string;
  date: string;
  meal: PlannedMeal;
  recipe: RecipeRow | undefined;
  kosherLevel: KosherLevel;
  waitHours: number;
  weekday: Weekday;
  dayMeals: readonly PlannedMeal[];
  plan: WeeklyPlanPayload;
  recipes: ReadonlyMap<string, RecipeRow> | undefined;
  dislikedRecipeIds: readonly string[];
  dislikedIngredients: readonly DislikedIngredient[];
  preferredCuisines: readonly Cuisine[];
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
  const language = useLanguage();
  const planned = plannedMealCalories(props.meal);
  const upsert = useUpsertMealLog(props.weekStart);
  const remove = useDeleteMealLog(props.weekStart);
  const estimate = useEstimateSnackCalories();
  const [choosing, setChoosing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [note, setNote] = useState('');
  const [calories, setCalories] = useState('');
  const [tip, setTip] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [estimateFailed, setEstimateFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [savingAteId, setSavingAteId] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState(false);
  const replaceMeal = useReplacePlannedMeal();

  const footer =
    planned === null ? undefined : (
      <CheckInBody
        log={props.log}
        choosing={choosing}
        formOpen={formOpen}
        note={note}
        calories={calories}
        tip={tip}
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
                setTip('');
              },
            }
          );
        }}
        onCookElse={() => {
          setPickerError(false);
          setPickerOpen(true);
        }}
        onOpenOther={() => {
          const other = props.log?.status === 'other' ? props.log : undefined;
          setNote(other?.note ?? '');
          setCalories(other ? String(other.calories) : '');
          setTip('');
          setInvalid(false);
          setEstimateFailed(false);
          setFormOpen(true);
          setChoosing(true);
        }}
        onChange={() => {
          setFormOpen(false);
          setChoosing(true);
          setTip('');
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
                      setTip('');
                    },
                  }
                ),
            },
          ]);
        }}
        onNote={(next) => {
          setNote(clampSnackText(next));
          setEstimateFailed(false);
          setTip('');
        }}
        onCalories={setCalories}
        onEstimate={() => {
          const description = note.trim();
          if (wordCount(description) === 0) return;
          setEstimateFailed(false);
          setTip('');
          estimate.mutate(
            { description, language },
            {
              onSuccess: (result) => {
                setCalories(String(result.calories));
                setTip(result.tip);
                setInvalid(false);
              },
              onError: () => setEstimateFailed(true),
            }
          );
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
                setTip('');
              },
            }
          );
        }}
        onCancelForm={() => {
          setFormOpen(false);
          setTip('');
          if (props.log) setChoosing(false);
        }}
      />
    );

  const planDish = (dish: PickerDish) => {
    const next = replaceMealInPlan(
      props.plan,
      props.date,
      props.meal.slot,
      dish.recipe,
      props.recipes ?? new Map()
    );
    if (!next) {
      setPickerError(true);
      return;
    }
    setPickerError(false);
    setSavingPlanId(dish.recipe.id);
    replaceMeal.mutate(next, {
      onSuccess: () => {
        setSavingPlanId(null);
        setPickerOpen(false);
      },
      onError: () => {
        setSavingPlanId(null);
        setPickerError(true);
      },
    });
  };

  const ateDish = (dish: PickerDish) => {
    setPickerError(false);
    setSavingAteId(dish.recipe.id);
    upsert.mutate(
      {
        loggedOn: props.date,
        slot: props.meal.slot,
        status: 'other',
        calories: dish.calories,
        note: localizedTitle(dish.recipe, language),
      },
      {
        onSuccess: () => {
          setSavingAteId(null);
          setPickerOpen(false);
          setChoosing(false);
          setFormOpen(false);
        },
        onError: () => {
          setSavingAteId(null);
          setPickerError(true);
        },
      }
    );
  };

  return (
    <>
      <MealCard
        meal={props.meal}
        recipe={props.recipe}
        kosherLevel={props.kosherLevel}
        onOpenRecipe={props.onOpenRecipe}
        footer={footer}
      />
      {planned !== null && (
        <DishPicker
          visible={pickerOpen}
          recipes={[...(props.recipes?.values() ?? [])]}
          query={pickerQuery({
            meal: props.meal,
            weekday: props.weekday,
            dayMeals: props.dayMeals,
            kosherLevel: props.kosherLevel,
            waitHours: props.waitHours,
            dislikedRecipeIds: props.dislikedRecipeIds,
            dislikedIngredients: props.dislikedIngredients,
            preferredCuisines: props.preferredCuisines,
          })}
          meal={props.meal}
          savingPlanId={savingPlanId}
          savingAteId={savingAteId}
          error={pickerError}
          onClose={() => {
            if (savingPlanId || savingAteId) return;
            setPickerOpen(false);
          }}
          onPlan={planDish}
          onAte={ateDish}
        />
      )}
    </>
  );
}

function CheckInBody(props: {
  log: MealLog | undefined;
  choosing: boolean;
  formOpen: boolean;
  note: string;
  calories: string;
  tip: string;
  invalid: boolean;
  estimateFailed: boolean;
  saving: boolean;
  estimating: boolean;
  failed: boolean;
  onAteThis: () => void;
  onCookElse: () => void;
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
        {props.tip !== '' && (
          <View className="gap-1 rounded-2xl border border-brand-200 bg-brand-50 px-3 py-2">
            <View className="flex-row items-center gap-1.5">
              <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={COLORS.brandDark} />
              <Text className="text-xs font-semibold text-brand-700">{t('checkIn.tipLabel')}</Text>
            </View>
            <Text className="text-sm text-gray-800">{props.tip}</Text>
            <Text className="text-xs text-gray-500">{t('checkIn.tipDisclaimer')}</Text>
          </View>
        )}
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
      <View className="gap-2">
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
        <Pressable accessibilityRole="button" onPress={props.onCookElse} className="self-start py-1">
          <Text className="text-sm font-semibold text-brand-700">{t('dishPicker.open')}</Text>
        </Pressable>
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
