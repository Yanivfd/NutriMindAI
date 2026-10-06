import { type ReactNode, useState } from 'react';

import { FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayDate, parseIsoDate, parseTime, toIsoDate, yearsBefore } from '@/lib/dateInput';
import { useLayoutDirection, useT } from '@/lib/i18n';

import { Text } from './Text';
import { Button, PickerField } from './ui';

const ROW_HEIGHT = 44;
const DEFAULT_BIRTH_DATE = new Date(1990, 0, 1);
const MIN_AGE = 16;
const MAX_AGE = 100;

const pad = (n: number) => String(n).padStart(2, '0');

function range(from: number, to: number): string[] {
  const values: string[] = [];
  const step = from <= to ? 1 : -1;
  for (let n = from; step > 0 ? n <= to : n >= to; n += step) values.push(pad(n));
  return values;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Scrollable column; the selected row is green. */
function Wheel(props: { options: string[]; selected: string; onSelect: (value: string) => void }) {
  const index = Math.max(0, props.options.indexOf(props.selected));
  return (
    <FlatList
      data={props.options}
      keyExtractor={(item) => item}
      style={{ height: ROW_HEIGHT * 5 }}
      initialScrollIndex={index}
      getItemLayout={(_data, itemIndex) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * itemIndex,
        index: itemIndex,
      })}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const selected = item === props.selected;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => props.onSelect(item)}
            style={{ height: ROW_HEIGHT }}
            className={`items-center justify-center rounded-2xl ${selected ? 'bg-brand-100' : ''}`}
          >
            <Text className={selected ? 'text-lg font-bold text-brand-700' : 'text-base text-gray-500'}>
              {item}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

function PickerSheet(props: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const direction = useLayoutDirection();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          className="absolute inset-0 bg-black/40"
          onPress={props.onClose}
        />
        <View
          style={{ direction, paddingBottom: insets.bottom + 16 }}
          className="gap-4 rounded-t-3xl bg-white px-4 pt-5"
        >
          <Text className="text-lg font-bold text-gray-900">{props.title}</Text>
          <View className="flex-row gap-3">{props.children}</View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label={t('common.cancel')} variant="secondary" onPress={props.onClose} />
            </View>
            <View className="flex-1">
              <Button label={t('common.done')} onPress={props.onConfirm} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Column(props: { label: string; options: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <View className="flex-1">
      <Text className="mb-1 text-center text-xs font-medium text-gray-500">{props.label}</Text>
      <Wheel options={props.options} selected={props.selected} onSelect={props.onSelect} />
    </View>
  );
}

/** Birth date chosen from green year/month/day columns; the value stays 'YYYY-MM-DD'. */
export function BirthDateField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const initial = parseIsoDate(props.value) ?? DEFAULT_BIRTH_DATE;
  const [year, setYear] = useState(String(initial.getFullYear()));
  const [month, setMonth] = useState(pad(initial.getMonth() + 1));
  const [day, setDay] = useState(pad(initial.getDate()));

  const today = new Date();
  const latestYear = yearsBefore(today, MIN_AGE).getFullYear();
  const earliestYear = yearsBefore(today, MAX_AGE).getFullYear();
  const maxDay = daysInMonth(Number(year), Number(month));
  const safeDay = String(Math.min(Number(day), maxDay)).padStart(2, '0');

  const openPicker = () => {
    const date = parseIsoDate(props.value) ?? DEFAULT_BIRTH_DATE;
    setYear(String(date.getFullYear()));
    setMonth(pad(date.getMonth() + 1));
    setDay(pad(date.getDate()));
    setOpen(true);
  };

  const shownText = props.value ? displayDate(props.value) : '';

  return (
    <>
      <PickerField
        label={props.label}
        value={shownText}
        placeholder="DD/MM/YYYY"
        icon="calendar-blank"
        onPress={openPicker}
        error={props.error}
      />
      {open && (
      <PickerSheet
        visible={open}
        title={props.label}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          props.onChange(toIsoDate(new Date(Number(year), Number(month) - 1, Number(safeDay))));
          setOpen(false);
        }}
      >
        <Column label={t('picker.day')} options={range(1, maxDay)} selected={safeDay} onSelect={setDay} />
        <Column label={t('picker.month')} options={range(1, 12)} selected={month} onSelect={setMonth} />
        <Column
          label={t('picker.year')}
          options={range(latestYear, earliestYear)}
          selected={year}
          onSelect={setYear}
        />
      </PickerSheet>
      )}
    </>
  );
}

/** Time of day chosen from green hour/minute columns; the value stays 'HH:MM'. */
export function TimeField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const initial = parseTime(props.value) ?? parseTime('12:00') ?? new Date();
  const [hour, setHour] = useState(pad(initial.getHours()));
  const [minute, setMinute] = useState(pad(initial.getMinutes()));

  const openPicker = () => {
    const time = parseTime(props.value) ?? parseTime('12:00') ?? new Date();
    setHour(pad(time.getHours()));
    setMinute(pad(time.getMinutes()));
    setOpen(true);
  };

  return (
    <>
      <PickerField
        label={props.label}
        value={props.value}
        placeholder="13:00"
        icon="clock-outline"
        onPress={openPicker}
        error={props.error}
      />
      {open && (
      <PickerSheet
        visible={open}
        title={props.label}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          props.onChange(`${hour}:${minute}`);
          setOpen(false);
        }}
      >
        <Column label={t('picker.hour')} options={range(0, 23)} selected={hour} onSelect={setHour} />
        <Column label={t('picker.minute')} options={range(0, 59)} selected={minute} onSelect={setMinute} />
      </PickerSheet>
      )}
    </>
  );
}
