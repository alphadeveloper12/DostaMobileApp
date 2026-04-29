/**
 * CateringPlanScreen — faithful 1:1 translation of web pages/catering/pages/Catering.tsx
 * and all step sub-components.
 *
 * Each step card mirrors the web:
 *   - bg-neutral-white border border-[#EDEEF2] rounded-2xl p-4 md:p-6
 *   - Step number circle: bg-primary w-8 h-8 rounded-full text-white font-bold
 *   - h2 text-xl md:text-2xl font-bold text-primary-text
 *   - Option buttons: h-[56px] or h-[80px], rounded-[16px], border-[#C7C8D2]
 *     active: bg-[#EAF5FF] border-[#054A86]
 *     disabled: bg-[#F5F5F5] text-[#A0A0A0] opacity-0.7
 *   - Go Back: border border-[#054A86] text-[#054A86] rounded-[8px] py-[12px] px-[16px]
 *   - Continue: bg-[#054A86] text-white rounded-[8px] py-[12px] px-[16px]
 *
 * Step routing (identical to web handleContinue / handleGoBack):
 *   1→2→3 always
 *   3→4 (buffet/set menu) | 3→5 (others/ramadan/iftarboxes)
 *   4→5 always
 *   5→7 (buffet/set) | 5→9 (coffee) | 5→10 (platters) | 5→12 (live) |
 *       5→13 (american) | 5→14 (canape) | 5→15 (ramadan) | 5→16 (iftarboxes)
 *   7,9,10,12,13,14,15,16 → 8 (summary)
 *
 * API calls exactly match web sources.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Linking, StyleSheet, Dimensions,
  Modal, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Calendar as CalendarIcon, Check } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import BreadCrumb from '@/components/ui/BreadCrumb';
import Shimmer from '@/components/ui/Shimmer';
import AuthPromptModal from '@/components/common/AuthPromptModal';
import { getAuthToken, storage, setPendingCateringOrder } from '@/utils/storage';
import { BASE_URL } from '@/services/api';
import EventTypeCard from './components/EventTypeCard';

const { width: W } = Dimensions.get('window');

// ── Wizard state ──────────────────────────────────────────────────────────────
interface WizardState {
  selectedEvent:             { id: string | null; name: string | null; description?: string } | null;
  selectedDetailedEventName: { id: string | null; name: string | null } | null;
  guestCount:                number;
  selectedDateTime:          string | null;
  selectedProvider:          { id: string | null; name: string | null } | null;
  selectedServiceStyles:     { id: number; name: string; description?: string; min_pax?: number } | null;
  selectedMenuDescription:   string | null;
  selectedCuisines:          { id: number; name: string }[];
  selectedCourses:           { id: number; name: string }[];
  selectedLocation:          { id: number | null; name: string | null } | null;
  selectedBudget:            { id: string | null; label: string | null; price_range: string | null };
  selectedPax:               { id: string | null; label: string | null; number: string | null };
  selectedMenuItems:         { id: string; name: string; course: string; description?: string; price?: number; image_url?: string }[];
}

const INIT: WizardState = {
  selectedEvent: null, selectedDetailedEventName: null, guestCount: 1,
  selectedDateTime: null, selectedProvider: null, selectedServiceStyles: null,
  selectedMenuDescription: null, selectedCuisines: [], selectedCourses: [],
  selectedLocation: null,
  selectedBudget: { id: null, label: null, price_range: null },
  selectedPax: { id: null, label: null, number: null },
  selectedMenuItems: [],
};

// ── Step routing (identical to web) ──────────────────────────────────────────
function sm(name: string | undefined, ...kw: string[]) {
  const n = (name || '').toLowerCase();
  return kw.some(k => n.includes(k));
}
function nextStep(step: number, st: WizardState): number {
  const s = st.selectedServiceStyles?.name;
  const isBuffet   = sm(s, 'buffet', 'set menu');
  const isPlatters = sm(s, 'platter');
  const isCanape   = sm(s, 'canape');
  const isLive     = sm(s, 'live station');
  const isIftarBox = sm(s, 'iftar') && sm(s, 'box');
  const isRamadan  = !isIftarBox && (sm(s, 'iftar') || sm(s, 'sohour'));
  const isAmerican = st.selectedCuisines.some(c => c.name.toLowerCase() === 'american');

  // Match web: Continue is only revealed once both the event AND a datetime
  // have been picked, so advance only when both are present.
  if (step === 1 && st.selectedEvent?.id && st.selectedDateTime) return 2;
  if (step === 2 && st.selectedLocation?.id)       return 3;
  if (step === 3 && st.selectedServiceStyles) {
    if (isRamadan || isIftarBox) return 5;
    if (isBuffet)                return 4;
    return 5;
  }
  if (step === 4 && st.selectedCuisines.length > 0) return 5;
  if (step === 5 && st.selectedBudget?.id) {
    if (isIftarBox)  return 16;
    if (isRamadan)   return 15;
    if (isAmerican)  return 13;
    if (isBuffet)    return 7;
    if (isPlatters)  return 10;
    if (isLive)      return 12;
    if (isCanape)    return 14;
    return 9;
  }
  if ([7, 9, 10, 12, 13, 14, 15, 16].includes(step)) return 8;
  return step;
}
function prevStep(step: number, st: WizardState): number {
  const s = st.selectedServiceStyles?.name;
  const isBuffet   = sm(s, 'buffet', 'set menu');
  const isPlatters = sm(s, 'platter');
  const isCanape   = sm(s, 'canape');
  const isLive     = sm(s, 'live station');
  const isIftarBox = sm(s, 'iftar') && sm(s, 'box');
  const isRamadan  = !isIftarBox && (sm(s, 'iftar') || sm(s, 'sohour'));
  const isAmerican = st.selectedCuisines.some(c => c.name.toLowerCase() === 'american');

  if (step === 2) return 1;
  if (step === 3) return 2;
  if (step === 4) return 3;
  if (step === 5) {
    if (isRamadan || isIftarBox) return 3;
    if (isBuffet)                return 4;
    return 3;
  }
  if (step === 7)  return 5;
  if (step === 8) {
    if (isIftarBox)  return 16;
    if (isRamadan)   return 15;
    if (isAmerican)  return 13;
    if (isBuffet)    return 7;
    if (isPlatters)  return 10;
    if (isLive)      return 12;
    if (isCanape)    return 14;
    return 9;
  }
  if ([9, 10, 12, 13, 14, 15, 16].includes(step)) return 5;
  return Math.max(1, step - 1);
}

// ── Shared option button ────────────────────────────────────────────────────
// `disabled` controls visuals only — the press still bubbles up so callers
// can react (e.g. show a "Minimum N guests required" tooltip on Step 3).
const OptionBtn = ({ label, selected, onPress, disabled, subLabel, image }: {
  label: string; selected: boolean; onPress: () => void;
  disabled?: boolean; subLabel?: string; image?: string;
}) => (
  <TouchableOpacity
    style={[
      bs.optBtn,
      selected && bs.optBtnActive,
      disabled && bs.optBtnDisabled,
      subLabel && { minHeight: 76, paddingVertical: 10 },
      image && { flexDirection: 'row', justifyContent: 'flex-start', paddingVertical: 8, minHeight: 80 },
    ]}
    onPress={onPress}
    activeOpacity={disabled ? 1 : 0.85}>
    {image ? (
      <Image source={{ uri: image }} style={bs.optBtnImage} contentFit="cover" />
    ) : null}
    <View style={image ? { flex: 1 } : undefined}>
      <Text
        style={[
          bs.optBtnText,
          selected && bs.optBtnTextActive,
          disabled && bs.optBtnTextDisabled,
          image && { textAlign: 'left', fontWeight: '500' },
        ]}
        numberOfLines={2}>
        {label}
      </Text>
      {subLabel ? (
        <Text
          style={[bs.optBtnSubText, selected && bs.optBtnTextActive, disabled && bs.optBtnTextDisabled]}
          numberOfLines={1}>
          {subLabel}
        </Text>
      ) : null}
    </View>
  </TouchableOpacity>
);

// ── Step number circle (bg-primary) ──────────────────────────────────────────
const StepCircle = ({ n }: { n: number }) => (
  <View style={bs.stepCircle}>
    <Text style={bs.stepCircleText}>{n}</Text>
  </View>
);

// ── Go Back / Continue buttons ────────────────────────────────────────────────
const NavBtns = ({ onBack, onContinue, loading, continueDisabled, continueLabel }: {
  onBack?: () => void; onContinue: () => void;
  loading?: boolean; continueDisabled?: boolean; continueLabel?: string;
}) => (
  <View style={bs.navRow}>
    {onBack && (
      <TouchableOpacity style={bs.backBtn} onPress={onBack}>
        <Text style={bs.backBtnText}>Go Back</Text>
      </TouchableOpacity>
    )}
    <TouchableOpacity
      style={[bs.contBtn, continueDisabled && bs.contBtnDisabled]}
      onPress={onContinue}
      disabled={loading || continueDisabled}>
      {loading ? <ActivityIndicator color="#fff" size="small" /> : (
        <Text style={bs.contBtnText}>{continueLabel || 'Continue'}</Text>
      )}
    </TouchableOpacity>
  </View>
);

// ── Date/Time picker sheet — mirrors web `formattedDateTime` format
//    "Day, Month, Year - HH:MM" so the summary reads identically.
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
function formatDateTime(d: Date): string {
  const day = d.getDate();
  const monthName = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${day}, ${monthName}, ${year} - ${hh}:${mm}`;
}

const DateTimeSheet = ({
  visible, onClose, onConfirm, initial,
}: {
  visible: boolean; onClose: () => void;
  onConfirm: (formatted: string) => void;
  initial?: Date;
}) => {
  const [phase, setPhase] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState<Date>(initial || new Date());

  useEffect(() => {
    if (visible) { setPhase('date'); setTempDate(initial || new Date()); }
  }, [visible, initial]);

  const isAndroid = Platform.OS === 'android';

  // Android shows the native dialog as soon as the picker is mounted; chain
  // date → time → confirm. iOS uses inline spinners inside a modal sheet.
  if (isAndroid) {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={tempDate}
        mode={phase}
        is24Hour={false}
        display="default"
        minimumDate={phase === 'date' ? new Date() : undefined}
        onChange={(event, picked) => {
          if (event.type === 'dismissed' || !picked) { onClose(); return; }
          if (phase === 'date') {
            setTempDate(picked); setPhase('time');
          } else {
            const merged = new Date(tempDate);
            merged.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
            onConfirm(formatDateTime(merged));
          }
        }}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={dtStyles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={dtStyles.sheet}>
          <Text style={dtStyles.title}>Select Event Date &amp; Time</Text>

          <Text style={dtStyles.subLabel}>Date</Text>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            minimumDate={new Date()}
            onChange={(_, d) => d && setTempDate(d)}
          />

          <Text style={dtStyles.subLabel}>Time</Text>
          <DateTimePicker
            value={tempDate}
            mode="time"
            display="spinner"
            onChange={(_, d) => d && setTempDate(d)}
          />

          <View style={dtStyles.actions}>
            <TouchableOpacity style={dtStyles.cancelBtn} onPress={onClose}>
              <Text style={dtStyles.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dtStyles.confirmBtn}
              onPress={() => onConfirm(formatDateTime(tempDate))}>
              <Text style={dtStyles.confirmTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── Step interface ────────────────────────────────────────────────────────────
interface StepProps { st: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void; onBack: () => void; }

// ── Step 1: Event Type Selection ──────────────────────────────────────────────
const Step1EventType = ({ st, update, onNext, onBack }: StepProps) => {
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const res = await axios.get(`${BASE_URL}/api/catering/event-types/`, {
          headers: token ? { Authorization: `Token ${token}` } : {},
        });
        setEventTypes(res.data);
      } catch { } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={bs.card}>
      <View style={bs.cardHeader}>
        <StepCircle n={1} />
        <Text style={bs.cardTitle}>What Type Of Event Are you Planning?</Text>
      </View>

      {loading ? <Shimmer /> : (
        <View style={bs.eventGrid}>
          {eventTypes.map(ev => (
            // Width owner — 48% × 2 cards + space-between gap = always 2 per row
            <View key={ev.id} style={{ width: '48%' }}>
              <EventTypeCard
                image={ev.image_url}
                title={ev.name}
                selected={st.selectedEvent?.id === String(ev.id)}
                onPress={() => update({ selectedEvent: { id: String(ev.id), name: ev.name, description: ev.description } })}
              />
            </View>
          ))}
        </View>
      )}

      {/* Guest count — shown after event selected */}
      {st.selectedEvent?.id && (
        <View style={{ marginTop: 24 }}>
          <Text style={bs.subHeader}>How Many Guests are you expecting?</Text>
          <View style={bs.guestRow}>
            <TouchableOpacity
              style={bs.guestBtn}
              onPress={() => update({ guestCount: Math.max(1, st.guestCount - 1) })}>
              <Text style={bs.guestBtnText}>-</Text>
            </TouchableOpacity>
            <TextInput
              style={bs.guestInput}
              value={String(st.guestCount || '')}
              keyboardType="number-pad"
              onChangeText={v => update({ guestCount: parseInt(v) || 0 })}
            />
            <TouchableOpacity
              style={bs.guestBtn}
              onPress={() => update({ guestCount: st.guestCount + 1 })}>
              <Text style={bs.guestBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Date & Time — mirrors web. Continue stays hidden until both
              event AND a datetime are picked. */}
          {st.selectedDateTime ? (
            <View style={{ marginTop: 24 }}>
              <Text style={bs.subHeader}>Date and Time of the Event?</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <Text style={{ fontSize: 16, color: Colors.neutralBlack }}>{st.selectedDateTime}</Text>
                <TouchableOpacity onPress={() => setPickerOpen(true)}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primaryBlue, textDecorationLine: 'underline' }}>
                    Change Date/Time
                  </Text>
                </TouchableOpacity>
              </View>

              <NavBtns
                onBack={onBack}
                onContinue={onNext}
                continueDisabled={!st.selectedEvent?.id || !st.selectedDateTime}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={[bs.contBtn, { marginTop: 24, alignSelf: 'flex-start', paddingHorizontal: 20 }, !st.guestCount && bs.contBtnDisabled]}
              disabled={!st.guestCount}
              onPress={() => setPickerOpen(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CalendarIcon size={16} color={Colors.neutralWhite} />
                <Text style={bs.contBtnText}>Select Date and Time</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      <DateTimeSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={(formatted) => { update({ selectedDateTime: formatted }); setPickerOpen(false); }}
        initial={st.selectedDateTime ? new Date() : undefined}
      />
    </View>
  );
};

// ── Step 2: Location Selection ────────────────────────────────────────────────
const Step2Location = ({ st, update, onNext, onBack }: StepProps) => {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const res = await axios.get(`${BASE_URL}/api/catering/locations/`, {
          headers: token ? { Authorization: `Token ${token}` } : {},
        });
        // Sort: Dubai → Sharjah → Ajman → others (identical to web)
        const sorted = res.data.sort((a: any, b: any) => {
          const p = (n: string) => {
            const l = (n || '').toLowerCase();
            if (l.includes('dubai'))   return 1;
            if (l.includes('sharjah')) return 2;
            if (l.includes('ajman'))   return 3;
            return 4;
          };
          return p(a.name) - p(b.name);
        });
        setLocations(sorted);
      } catch { } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={bs.card}>
      <View style={bs.cardHeader}>
        <StepCircle n={2} />
        <Text style={bs.cardTitle}>Where is your Event?</Text>
      </View>

      {loading ? <Shimmer /> : (
        <View style={bs.optGrid}>
          {locations.map(loc => (
            <OptionBtn
              key={loc.id}
              label={loc.name}
              selected={st.selectedLocation?.id === loc.id}
              onPress={() => update({ selectedLocation: { id: loc.id, name: loc.name } })}
            />
          ))}
        </View>
      )}

      <NavBtns
        onBack={onBack}
        onContinue={onNext}
        continueDisabled={!st.selectedLocation?.id}
      />
    </View>
  );
};

// ── Step 3: Provider / Service Style ─────────────────────────────────────────
const Step3Provider = ({ st, update, onNext, onBack }: StepProps) => {
  const [serviceStyles, setServiceStyles] = useState<any[]>([]);
  const [eventNames, setEventNames]       = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  // styleId of the disabled button currently showing its tooltip.
  // Mirrors the web's <Tippy> behaviour but tap-driven (RN has no hover).
  const [tipFor, setTipFor]               = useState<number | null>(null);
  const [tipMsg, setTipMsg]               = useState<string>('');

  const isCorporate = st.selectedEvent?.name?.toLowerCase().includes('corporate');
  const showEventName = !isCorporate && !st.selectedEvent?.name?.toLowerCase().includes('private chef');

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const hdrs = token ? { Authorization: `Token ${token}` } : {};
        const endpoint = isCorporate
          ? `${BASE_URL}/api/catering/service-styles/`
          : `${BASE_URL}/api/catering/service-styles-private/`;
        const reqs = [axios.get(endpoint, { headers: hdrs })];
        if (showEventName) reqs.push(axios.get(`${BASE_URL}/api/catering/event-names/`, { headers: hdrs }));
        const [stylesRes, namesRes] = await Promise.all(reqs);
        setServiceStyles(stylesRes.data);
        if (namesRes) setEventNames(namesRes.data);
      } catch { } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [isCorporate, showEventName]);

  // Auto-select Iftar/Sohour service style when event name is Iftar/Sohour
  useEffect(() => {
    if (!st.selectedDetailedEventName?.name || !serviceStyles.length) return;
    const evName = st.selectedDetailedEventName.name.toLowerCase();
    const match  = serviceStyles.find(s => s.name.toLowerCase().includes(evName));
    if (match && st.selectedServiceStyles?.id !== match.id) {
      update({ selectedServiceStyles: { id: match.id, name: match.name, min_pax: match.min_pax } });
    }
  }, [st.selectedDetailedEventName, serviceStyles]);

  if (loading) return <View style={bs.card}><Shimmer /></View>;

  const isPrivateChef = st.selectedEvent?.name?.toLowerCase().includes('private chef');
  const isRamadanEvt  = st.selectedDetailedEventName?.name === 'Iftar' || st.selectedDetailedEventName?.name === 'Sohour';

  const isContinueDisabled = showEventName
    ? !st.selectedServiceStyles || !st.selectedDetailedEventName?.id
    : !st.selectedServiceStyles;

  return (
    <View style={bs.card}>
      <View style={bs.cardHeader}>
        <StepCircle n={3} />
        <Text style={bs.cardTitle}>Select Service Style</Text>
      </View>

      {/* Event Name Section (conditional) */}
      {showEventName && (
        <View style={bs.subSection}>
          <Text style={bs.subHeader}>Select Event Name</Text>
          <View style={bs.optGrid}>
            {eventNames.map(ev => (
              <OptionBtn
                key={ev.id}
                label={ev.name}
                selected={st.selectedDetailedEventName?.id === String(ev.id)}
                onPress={() => {
                  update({ selectedDetailedEventName: { id: String(ev.id), name: ev.name }, selectedServiceStyles: null });
                }}
              />
            ))}
          </View>
        </View>
      )}

      {/* Service Style Section */}
      <View style={bs.subSection}>
        {showEventName && <Text style={bs.subHeader}>Select Service Style</Text>}
        <View style={bs.optGrid}>
          {serviceStyles
            .filter(style => {
              if (isCorporate) return true;
              return !style.name.toLowerCase().includes('iftar') && !style.name.toLowerCase().includes('sohour');
            })
            .map(style => {
              const isDisabled = isRamadanEvt
                ? true
                : isPrivateChef
                  ? st.guestCount > style.min_pax
                  : (style.min_pax || 0) > st.guestCount;

              // Reason text — same wording as the web Tippy tooltip
              const reason = isRamadanEvt
                ? `Service Style is automatically selected for ${st.selectedDetailedEventName?.name}`
                : isPrivateChef
                  ? `Maximum ${style.min_pax} guests allowed`
                  : `Minimum ${style.min_pax} guests required`;

              const tipShown = tipFor === style.id;

              return (
                <View key={style.id}>
                  <OptionBtn
                    label={style.name}
                    selected={st.selectedServiceStyles?.id === style.id}
                    disabled={isDisabled}
                    onPress={() => {
                      if (isDisabled) {
                        // Reveal the tooltip beneath this button. Auto-hides
                        // after a few seconds so it doesn't linger.
                        setTipFor(style.id);
                        setTipMsg(reason);
                        setTimeout(() => {
                          setTipFor(prev => (prev === style.id ? null : prev));
                        }, 2500);
                        return;
                      }
                      // If the user is switching to a non-cuisine service
                      // style (Coffee Break / Platters / Live Station / Canape
                      // / Ramadan / Iftar Boxes), wipe any cuisine selections
                      // left over from a previous buffet flow. Otherwise their
                      // IDs leak into the Step 5 budget request as e.g.
                      // `cuisine_ids=6` and the backend returns 0 options.
                      const stylesNeedsCuisine = sm(style.name, 'buffet', 'set menu');
                      update({
                        selectedServiceStyles: { id: style.id, name: style.name, description: style.description, min_pax: style.min_pax },
                        ...(stylesNeedsCuisine ? {} : { selectedCuisines: [], selectedMenuItems: [] }),
                      });
                    }}
                  />
                  {tipShown && (
                    <View style={bs.tipBubble}>
                      <Text style={bs.tipBubbleText}>{tipMsg}</Text>
                    </View>
                  )}
                </View>
              );
            })}
        </View>
      </View>

      <NavBtns onBack={onBack} onContinue={onNext} continueDisabled={isContinueDisabled} />
    </View>
  );
};

// ── Step 4: Cuisine Selection ─────────────────────────────────────────────────
const Step4Cuisine = ({ st, update, onNext, onBack }: StepProps) => {
  const [cuisines, setCuisines] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const params: any = {};
        if (st.selectedEvent?.name)        params.event_type_name  = st.selectedEvent.name;
        if (st.selectedServiceStyles?.id)  params.service_style_id = st.selectedServiceStyles.id;
        const res = await axios.get(`${BASE_URL}/api/catering/cuisines/`, {
          headers: token ? { Authorization: `Token ${token}` } : {},
          params,
        });
        setCuisines(res.data);
      } catch { } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const toggleCuisine = (c: any) => {
    // Single selection (radio-button style) — identical to web
    const isSelected = st.selectedCuisines.some(s => s.id === c.id);
    update({ selectedCuisines: isSelected ? [] : [{ id: c.id, name: c.name }] });
  };

  return (
    <View style={bs.card}>
      <View style={bs.cardHeader}>
        <StepCircle n={4} />
        <Text style={bs.cardTitle}>What's Type of Cuisines Would You Prefer?</Text>
      </View>

      <View style={bs.subSection}>
        <Text style={bs.noteText}>(You can select multiple options)</Text>
        {loading ? <Shimmer /> : (
          <View style={bs.optGrid}>
            {cuisines.map(c => (
              <OptionBtn
                key={c.id}
                label={c.name}
                image={c.image_url}
                selected={st.selectedCuisines.some(s => s.id === c.id)}
                onPress={() => toggleCuisine(c)}
              />
            ))}
          </View>
        )}
      </View>

      <NavBtns onBack={onBack} onContinue={onNext} continueDisabled={st.selectedCuisines.length === 0} />
    </View>
  );
};

// ── Step 5: Budget & Pax ──────────────────────────────────────────────────────
// Web sends `Authorization: Token <authToken>` always — but on web the user is
// almost always logged in. On mobile the user is typically a guest, and DRF's
// TokenAuthentication rejects the literal string "Token null"/"Token undefined"
// as an invalid token, returning either 401 or an empty filtered queryset
// instead of the public anonymous list. Omitting the header entirely lets the
// request fall through to AnonymousUser and the public budget tiers — which is
// exactly what we want for guests, and matches the web behaviour for them too.
//
// Other improvements:
//   - Refetches whenever service_style / cuisines / event change so going back
//     and changing the service style on step 3 reloads the correct budget tiers
//     when the user returns to step 5.
//   - Visible error UI with a Retry button instead of silent failure, so the
//     user can recover from a transient network error and we can surface real
//     status codes if the backend ever rejects the request.
const Step5Budget = ({ st, update, onNext, onBack }: StepProps) => {
  const [budgetOptions, setBudgetOptions] = useState<any[]>([]);
  const [paxOptions, setPaxOptions]       = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [reloadTick, setReloadTick]       = useState(0);

  const isBuffetOrSet = sm(st.selectedServiceStyles?.name, 'buffet', 'set menu');
  const stepNum       = isBuffetOrSet ? 5 : 4;
  const evName        = (st.selectedEvent?.name || '').toLowerCase();
  const isPrivateChef = evName.includes('private chef');
  const isPrivate     = !evName.includes('corporate');
  const serviceStyleId = st.selectedServiceStyles?.id;
  // Only buffet / set-menu flows pass cuisines into the budget query. For
  // every other service style the backend expects `cuisine_ids=` empty —
  // sending a stale leftover ID returns 0 options.
  const cuisineIds     = isBuffetOrSet ? st.selectedCuisines.map(c => c.id).join(',') : '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const t = setTimeout(async () => {
      const rawToken = await getAuthToken();
      // Match web verbatim — always attach `Authorization: Token <value>`. Web
      // sends literally `Token ${authToken}` regardless of auth state.
      const token = rawToken ?? '';
      const headers: Record<string, string> = { Authorization: `Token ${token}` };
      const budgetURL = `${BASE_URL}/api/catering/budget-options/`;
      const paxURL    = `${BASE_URL}/api/catering/pax/`;

      const params = {
        service_style_id: serviceStyleId,
        is_private:       isPrivate,
        is_private_chef:  isPrivateChef,
        cuisine_ids:      cuisineIds,
      };

      // Bulletproof parser — RN's axios occasionally hands the body back as a
      // JSON string (when the server omits Content-Type or sets text/plain),
      // or wrapped inside { data: [...] } / { results: [...] } / etc. Try
      // every plausible shape, and fall back to treating any single object
      // that *looks* like a budget option as a one-element list.
      const looksLikeBudget = (x: any) =>
        x && typeof x === 'object' && (x.price_range || x.label || x.max_price);
      const extractList = (raw: any): any[] => {
        let d: any = raw;
        if (typeof d === 'string') {
          try { d = JSON.parse(d); } catch { return []; }
        }
        if (Array.isArray(d)) return d;
        if (!d || typeof d !== 'object') return [];
        const candidates = [d.budget_options, d.results, d.data, d.items, d.options];
        for (const c of candidates) if (Array.isArray(c)) return c;
        if (looksLikeBudget(d)) return [d];
        for (const v of Object.values(d)) {
          if (Array.isArray(v) && v.every(looksLikeBudget)) return v;
        }
        return [];
      };
      const extractPaxList = (raw: any): any[] => {
        let d: any = raw;
        if (typeof d === 'string') {
          try { d = JSON.parse(d); } catch { return []; }
        }
        if (Array.isArray(d)) return d;
        if (!d || typeof d !== 'object') return [];
        const candidates = [d.pax, d.results, d.data, d.items];
        for (const c of candidates) if (Array.isArray(c)) return c;
        return [];
      };

      const transformResponse = [(data: any) => {
        if (typeof data !== 'string') return data;
        try { return JSON.parse(data); } catch { return data; }
      }];

      try {
        const [budgetRes, paxRes] = await Promise.all([
          axios.get(budgetURL, { headers, params, transformResponse }),
          axios.get(paxURL,    { headers, params: {
            service_style_id: serviceStyleId,
            is_private:       isPrivate,
            is_private_chef:  isPrivateChef,
          }, transformResponse }),
        ]);
        if (cancelled) return;

        const budgetArr = extractList(budgetRes.data);

        const sorted = [...budgetArr].sort((a: any, b: any) => {
          const getPrice = (str: string) => { const m = str?.match(/\d+/); return m ? parseInt(m[0]) : 0; };
          return getPrice(a.price_range) - getPrice(b.price_range);
        });
        setBudgetOptions(sorted);

        const rawPax = extractPaxList(paxRes.data);
        setPaxOptions(rawPax);

        const match = rawPax.find((p: any) => {
          const nums = p.number?.match(/\d+/g)?.map(Number) || [];
          return nums.length === 1 ? st.guestCount <= nums[0] :
                 nums.length === 2 ? st.guestCount >= nums[0] && st.guestCount <= nums[1] : false;
        });
        if (match) update({ selectedPax: { id: String(match.id), label: match.label, number: match.number } });
        else if (rawPax.length > 0) {
          const f = rawPax[0];
          update({ selectedPax: { id: String(f.id), label: f.label, number: f.number } });
        }

        if (sorted.length === 0) {
          setError('No budget options are available for this service style.');
        }
      } catch (e: any) {
        if (cancelled) return;
        const status = e?.response?.status;
        const body   = e?.response?.data;
        console.error('[Step5Budget] budget-options fetch failed', {
          url: budgetURL, params, status, body, message: e?.message,
        });
        setError(
          status
            ? `Failed to load budget options (HTTP ${status}). Tap retry.`
            : `Network error: ${e?.message || 'unknown'}. Tap retry.`
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 1000);

    return () => { cancelled = true; clearTimeout(t); };
  }, [serviceStyleId, isPrivate, isPrivateChef, cuisineIds, reloadTick]);

  return (
    <View style={bs.card}>
      <View style={bs.cardHeader}>
        <StepCircle n={stepNum} />
        <Text style={bs.cardTitle}>What's the Budget you have in Mind?</Text>
      </View>

      {loading ? <Shimmer /> : error ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: Colors.neutralGrayDark, textAlign: 'center', marginBottom: 12 }}>
            {error}
          </Text>
          <TouchableOpacity
            style={[bs.contBtn, { paddingHorizontal: 24, alignSelf: 'center' }]}
            onPress={() => setReloadTick(x => x + 1)}>
            <Text style={bs.contBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={bs.optGrid}>
            {budgetOptions.map(b => (
              <OptionBtn
                key={b.id}
                label={b.label}
                subLabel={b.price_range}
                selected={st.selectedBudget?.id === String(b.id)}
                onPress={() => update({ selectedBudget: { id: String(b.id), label: b.label, price_range: b.price_range } })}
              />
            ))}
          </View>

          <View style={bs.subSection}>
            <Text style={bs.subHeader}>
              {isPrivateChef ? 'Select Maximum Pax' : 'Select Minimum Pax'}
            </Text>
            <View style={bs.optGrid}>
              {paxOptions.map(p => (
                <OptionBtn
                  key={p.id}
                  label={isPrivateChef ? p.label.replace('Minimum', 'Maximum') : p.label}
                  subLabel={p.number}
                  selected={st.selectedPax?.id === String(p.id)}
                  onPress={() => {}}
                />
              ))}
            </View>
          </View>
        </>
      )}

      <NavBtns onBack={onBack} onContinue={onNext} continueDisabled={!st.selectedBudget?.id} />
    </View>
  );
};

// ── Step 7: Courses Menu (faithful to web CoursesMenu.tsx) ──────────────────
// The web step circle reads "6" even though state is 7; web auto-selects every
// item in every course (cards always show the green "ADDED" badge and the
// item is non-toggleable), and the bottom CTA reads "Review Catering Service".
const COURSE_PRIORITY = (title: string) => {
  const t = (title || '').toLowerCase();
  if (t.includes('salad'))     return 1;
  if (t.includes('appetizer')) return 2;
  if (t.includes('soup'))      return 3;
  if (t.includes('main'))      return 4;
  if (t.includes('dessert') || t.includes('desert')) return 100;
  if (t.includes('beverage') || t.includes('drink')) return 101;
  return 50;
};

const Step7CoursesMenu = ({ st, update, onNext, onBack }: StepProps) => {
  const [groups, setGroups] = useState<{ id: number; title: string; items: any[] }[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable derivative for the effect deps — `selectedCuisines` is a new array
  // reference on every parent re-render, so we key off the joined ID string
  // instead. Same trick the web uses (cuisineIds).
  const cuisineIds = st.selectedCuisines.map(c => c.id).join(',');
  const budgetId   = st.selectedBudget?.id || '';
  const eventId    = st.selectedEvent?.id || '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setGroups([]);
    const t = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const hdrs  = token ? { Authorization: `Token ${token}` } : {};
        const isPrivate = !st.selectedEvent?.name?.toLowerCase().includes('corporate');

        let grouped: { id: number; title: string; items: any[] }[] = [];
        const allItems: any[] = [];

        if (budgetId) {
          // PRIMARY (web `fixed-menus`) — budget-aware endpoint. Returns
          // a single curated menu with embedded items + courses keyed by id.
          const res = await axios.get(`${BASE_URL}/api/catering/fixed-menus/`, {
            headers: hdrs,
            params: { cuisine_ids: cuisineIds, budget_id: budgetId },
          });
          if (cancelled) return;

          if (Array.isArray(res.data) && res.data.length > 0) {
            const menu = res.data[0];
            const fixedItems   = menu.items   || [];
            const fixedCourses = menu.courses || [];

            grouped = fixedCourses
              .map((course: any) => {
                const courseItems = fixedItems
                  .filter((it: any) => it.course === course.id)
                  .map((it: any) => ({
                    id: String(it.id),
                    name: it.name,
                    course: course.name,
                    description: it.description,
                    image_url: it.image_url,
                  }));
                allItems.push(...courseItems);
                return { id: course.id, title: course.name, items: courseItems };
              })
              .filter((g: any) => g.items.length > 0);
          }
        }

        // FALLBACK (web `menu-items` path) — runs when fixed-menus has nothing
        // OR when the user hasn't picked a budget yet. Mirrors web exactly.
        if (grouped.length === 0) {
          const [itemsRes, coursesRes] = await Promise.all([
            axios.get(`${BASE_URL}/api/catering/menu-items/`, {
              headers: hdrs,
              params: { cuisine_ids: cuisineIds, budget_id: budgetId, is_private: isPrivate },
            }),
            axios.get(`${BASE_URL}/api/catering/courses/`, {
              headers: hdrs,
              params: { cuisine_ids: cuisineIds },
            }),
          ]);
          if (cancelled) return;

          const courseMap = new Map<number, string>();
          (coursesRes.data as any[]).forEach((c: any) => courseMap.set(c.id, c.name));

          const idx: Record<number, { id: number; title: string; items: any[] }> = {};
          (itemsRes.data as any[]).forEach((item: any) => {
            const cid = item.course;
            if (!idx[cid]) {
              idx[cid] = { id: cid, title: courseMap.get(cid) || `Course ${cid}`, items: [] };
            }
            const newItem = {
              id: String(item.id),
              name: item.name,
              course: idx[cid].title,
              description: item.description,
              image_url: item.image_url,
            };
            idx[cid].items.push(newItem);
            allItems.push(newItem);
          });
          grouped = Object.values(idx);
        }

        if (cancelled) return;
        const groupedSorted = grouped.sort(
          (a, b) => COURSE_PRIORITY(a.title) - COURSE_PRIORITY(b.title),
        );
        setGroups(groupedSorted);

        // Auto-select-all (matches web behaviour — items can't be unselected)
        update({ selectedMenuItems: allItems });
      } catch { } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  // Re-fetch whenever the upstream selections change — without this, going
  // back to Step 5 and picking a different budget leaves stale data in place.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuisineIds, budgetId, eventId]);

  // Group SELECTED items by course for the summary panel
  const groupedSelected = st.selectedMenuItems.reduce((acc, it) => {
    if (!acc[it.course]) acc[it.course] = [];
    acc[it.course].push(it);
    return acc;
  }, {} as Record<string, typeof st.selectedMenuItems>);

  return (
    <>
      <View style={bs.card}>
        {/* Web shows step #6 here even though state is 7 */}
        <View style={bs.cardHeader}>
          <StepCircle n={6} />
          <Text style={bs.cardTitle}>Menu options based on your selections and budget</Text>
        </View>

        <Text style={cm.subtitle}>The following items are included in your package:</Text>

        {loading ? <Shimmer /> : groups.length === 0 ? (
          <View style={cm.emptyBox}>
            <Text style={cm.emptyText}>
              No menu items available for this budget. Tap "Go Back" and try a different budget.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 24 }}>
            {groups.map(group => (
              <View key={group.id}>
                <Text style={cm.courseTitle}>{group.title}</Text>
                <View style={{ gap: 12 }}>
                  {group.items.map((item: any) => (
                    <View key={item.id} style={cm.itemCard}>
                      <View style={cm.imgWrap}>
                        {item.image_url ? (
                          <Image source={{ uri: item.image_url }} style={cm.img} contentFit="cover" />
                        ) : (
                          <View style={[cm.img, { backgroundColor: '#E5E7EB' }]} />
                        )}
                        <View style={cm.addedBadge}>
                          <Text style={cm.addedBadgeText}>ADDED</Text>
                        </View>
                      </View>
                      <Text style={cm.itemName}>{item.name}</Text>
                      <Text style={cm.itemDesc} numberOfLines={3}>
                        {item.description || 'Delicious option for your event.'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Selected Items panel — replaces web's right sidebar on mobile */}
      <View style={cm.summaryCard}>
        <Text style={cm.summaryTitle}>Selected Items</Text>
        {Object.keys(groupedSelected).length === 0 ? (
          <Text style={cm.summaryEmpty}>No items selected yet.</Text>
        ) : (
          <View style={{ gap: 16 }}>
            {Object.entries(groupedSelected).map(([course, items]) => (
              <View key={course}>
                <Text style={cm.summaryCourseLabel}>{course}</Text>
                {items.map(it => (
                  <Text key={it.id} style={cm.summaryItem}>{it.name}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[bs.contBtn, { marginTop: 20, height: 48 }, !st.selectedMenuItems.length && bs.contBtnDisabled]}
          disabled={!st.selectedMenuItems.length}
          onPress={onNext}
          activeOpacity={0.85}>
          <Text style={bs.contBtnText}>Review Catering Service</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[bs.backBtn, { marginTop: 10, height: 48 }]}
          onPress={onBack}
          activeOpacity={0.85}>
          <Text style={bs.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

// ── Steps 9/10/12/13/14/15/16: Unified menu (image-card UI, same as Step 7) ──
const MENU_ENDPOINTS: Record<string, string> = {
  coffeeBreak: '/api/catering/coffee-break-rotations/',
  platters:    '/api/catering/platter-items/',
  liveStation: '/api/catering/live-station-items/',
  american:    '/api/catering/american-menus/',
  canape:      '/api/catering/canape-items/',
  ramadan:     '/api/catering/ramadan-menus/',
  iftarBoxes:  '/api/catering/iftar-box-menus/',
};
const MENU_TITLES: Record<string, string> = {
  coffeeBreak: 'Select Your Coffee Break Rotation',
  platters:    'Platter Menu',
  liveStation: 'Live Station Menu',
  american:    'Select Your American Menu',
  canape:      'Canape Menu',
  ramadan:     'Select Your Ramadan Menu',
  iftarBoxes:  'Select Your Iftar Boxes Menu',
};
const MENU_SUBTITLES: Record<string, string> = {
  coffeeBreak: '',
  // Platter has its own special subtitle (PLATTER_SUBLINE) handled inline.
  platters:    '',
  liveStation: 'Minimum of 10 Pax',
  american:    'Please choose one of our curated menus below:',
  canape:      '',
  ramadan:     '',
  iftarBoxes:  'Please choose one of our curated menus below:',
};

// Menu types that show a horizontal tab strip ("Buffet Menu 1", "Buffet Menu
// 2", …) — user picks one menu, all its items get auto-selected. Mirrors the
// web's AmericanMenuSelection / RamadanMenuSelection / IftarBoxesMenuSelection
// / CoffeeBreakMenu behaviour where switching tabs replaces selectedMenuItems
// wholesale.
// Ramadan returns a single curated menu (menu_courses + items, all included).
// Iftar Boxes returns a menu with a single image. Neither is "tabbed".
const TABBED_MENUS = new Set(['american', 'coffeeBreak']);

// Coffee Break uses a rounded-pill style with "Start: " prefix + check mark
// (web CoffeeBreakMenu); other tabbed types use square chips with the menu
// name as the label.
const ROTATION_PREFIX_MENUS = new Set(['coffeeBreak']);

// Toggleable menus — user picks items individually (not auto-selected).
// Mirrors web PlatterMenu / LiveStationMenu / CanapeMenu, where each card is
// tappable to add/remove and the ADDED badge only shows when selected.
const TOGGLEABLE_MENUS = new Set(['platters', 'liveStation', 'canape']);

// Web PlatterMenu shows a subtitle line under the title.
const PLATTER_SUBLINE = 'Each Platter is good for 10 People / Price Starting from 600AED as Minimum';

// Canape category order — matches web CanapeMenu's groupedItems object order
const CANAPE_CATEGORY_ORDER = ['Cold', 'Hot', 'Arabic', 'Sweet', 'Vegetarian', 'Cold Beverages', 'Hot Beverages'];

// Canape per-category limits, derived from the budget price tier (web getConstraints)
function getCanapeConstraints(priceRange: string | null | undefined) {
  const price = parseInt(priceRange?.match(/\d+/)?.[0] || '0');
  if (price >= 135) return { food: 12, coldBev: 2, hotBev: 2 };
  if (price >= 120) return { food: 10, coldBev: 2, hotBev: 2 };
  if (price >= 100) return { food: 8,  coldBev: 1, hotBev: 1 };
  if (price >= 85)  return { food: 5,  coldBev: 1, hotBev: 1 };
  return { food: 3, coldBev: 1, hotBev: 1 };
}

// Maps a wizard menuType to the placeholder label shown when an item has no
// image_url or its remote image fails to load.
const FALLBACK_LABEL: Record<string, string> = {
  canape:      'Canape',
  platters:    'Platter',
  liveStation: 'Live Station',
  coffeeBreak: 'Coffee Break',
  american:    'Item',
  ramadan:     'Item',
  iftarBoxes:  'Iftar Box',
  courses:     'Item',
};

// Image with a "Canape"-style grey-text placeholder fallback. The placeholder
// fires both when `uri` is falsy AND when the remote image throws an onError
// (broken URL, 404, server hiccup). Local error state means each card decides
// independently — one broken image doesn't drop placeholders on the rest.
const MenuCardImage = ({ uri, fallback }: { uri?: string; fallback: string }) => {
  const [errored, setErrored] = useState(false);
  if (!uri || errored) {
    return (
      <View style={[cm.img, cm.imgFallback]}>
        <Text style={cm.imgFallbackText}>{fallback}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={cm.img}
      contentFit="cover"
      onError={() => setErrored(true)}
    />
  );
};

const StepMenu = ({ st, update, onNext, onBack, menuType }: StepProps & { menuType: string }) => {
  const [groups, setGroups] = useState<{ id: number; title: string; items: any[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [iftarBoxImage, setIftarBoxImage] = useState<string | null>(null);
  const [menuName, setMenuName] = useState<string>('');
  const [menuDescription, setMenuDescription] = useState<string>('');

  const isTabbed = TABBED_MENUS.has(menuType);

  // Same defensive pattern as Step7CoursesMenu — re-fetch whenever the
  // upstream selections change so going back and changing budget/cuisine
  // re-populates the menu instead of leaving stale items.
  const cuisineIds = st.selectedCuisines.map(c => c.id).join(',');
  const budgetId   = st.selectedBudget?.id || '';
  const eventId    = st.selectedEvent?.id || '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setGroups([]);
    setActiveTabId(null);
    setIftarBoxImage(null);
    setMenuName('');
    setMenuDescription('');
    const t = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const hdrs  = token ? { Authorization: `Token ${token}` } : {};

        // ── Ramadan: list-then-detail with mapped service_style_id + budget_option_id
        //   Web maps Iftar→15, Sohour→16 because the Private variants share menu data
        //   with the Corporate IDs. We do the same.
        if (menuType === 'ramadan') {
          const sn = (st.selectedServiceStyles?.name || '').toLowerCase();
          let mappedId: any = st.selectedServiceStyles?.id;
          if (sn.includes('iftar'))       mappedId = 15;
          else if (sn.includes('sohour')) mappedId = 16;

          const listRes = await axios.get(`${BASE_URL}/api/catering/ramadan-menus/`, {
            headers: hdrs,
            params: {
              service_style_id: mappedId,
              budget_option_id: budgetId,
              is_active: true,
            },
          });
          if (cancelled) return;
          const list = Array.isArray(listRes.data) ? listRes.data : [];
          if (list.length === 0) {
            setGroups([]);
          } else {
            const detailRes = await axios.get(
              `${BASE_URL}/api/catering/ramadan-menus/${list[0].id}/`,
              { headers: hdrs },
            );
            if (cancelled) return;
            const full = detailRes.data;
            setMenuName(full.name || 'Ramadan Menu');
            setMenuDescription(full.description || '');
            const courses = (full.menu_courses || [])
              .slice()
              .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
            const g: { id: number; title: string; items: any[] }[] = courses.map((c: any) => ({
              id:    c.id,
              title: c.course_name,
              items: (c.items || [])
                .slice()
                .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
            }));
            setGroups(g);
            // Auto-select all items, like the web does
            const allItems: any[] = [];
            g.forEach(grp => grp.items.forEach((it: any) => {
              allItems.push({
                id:          String(it.id),
                name:        it.name,
                course:      grp.title,
                description: it.description,
                quantity:    it.quantity,
                image_url:   it.image_url,
              });
            }));
            update({ selectedMenuItems: allItems });
          }
          return;
        }

        // ── Iftar Boxes: just an image and a name
        if (menuType === 'iftarBoxes') {
          const res = await axios.get(`${BASE_URL}/api/catering/iftar-box-menus/`, {
            headers: hdrs,
            params: { budget_option_id: budgetId, is_active: true },
          });
          if (cancelled) return;
          const list = Array.isArray(res.data) ? res.data : [];
          if (list.length > 0) {
            const m = list[0];
            setMenuName(m.name || 'Iftar Box Menu');
            setIftarBoxImage(m.image_url || null);
            // Iftar Boxes don't have item rows — but we still mark the user
            // as having "selected" something so Continue isn't disabled.
            update({
              selectedMenuItems: [{
                id: `iftar-box-${m.id}`,
                name: m.name || 'Iftar Box Menu',
                course: 'Iftar Box',
                image_url: m.image_url,
              } as any],
            });
          }
          return;
        }

        // ── Other menu types (coffee break / american / platters / live station / canape)
        const params: any = {};
        if (cuisineIds) params.cuisine_ids = cuisineIds;
        if (budgetId)   params.budget_id   = budgetId;
        if (eventId)    params.event_type_id = eventId;
        const res   = await axios.get(`${BASE_URL}${MENU_ENDPOINTS[menuType]}`, { headers: hdrs, params });
        if (cancelled) return;
        const raw   = res.data;
        let g: typeof groups = [];

        // Different endpoints return different shapes — normalize them all to
        // [{ id, title, items: [...] }] so the same image-card UI can render.
        if (menuType === 'coffeeBreak') {
          g = (Array.isArray(raw) ? raw : []).map((rot: any, i: number) => ({
            id: rot.id || i, title: rot.name || `Rotation ${i + 1}`, items: rot.items || [],
          }));
        } else if (TABBED_MENUS.has(menuType)) {
          const flat = Array.isArray(raw) ? raw : [];
          g = flat[0]?.items
            ? flat.map((m: any, i: number) => ({ id: m.id || i, title: m.name || 'Menu', items: m.items || [] }))
            : [{ id: 0, title: 'Items', items: flat }];
        } else {
          const data: any[] = Array.isArray(raw) ? raw : raw.items || [];
          const grouped: Record<string, any[]> = {};
          data.forEach((item: any) => {
            const grp = item.course || item.category || item.setup || 'Items';
            if (!grouped[grp]) grouped[grp] = [];
            grouped[grp].push(item);
          });
          g = Object.entries(grouped).map(([title, items], id) => ({ id, title, items }));
        }
        setGroups(g);

        if (TABBED_MENUS.has(menuType)) {
          // Tabbed menus — only the active tab's items count as selected.
          // Default to the first menu (matches web's `setActiveMenuId(menus[0].id)`).
          if (g.length > 0) setActiveTabId(g[0].id);
        } else if (TOGGLEABLE_MENUS.has(menuType)) {
          // User picks items individually — start empty, no auto-select.
          // (web PlatterMenu / LiveStationMenu / CanapeMenu behaviour)
          // We do NOT clear selectedMenuItems here in case the user
          // already had items from going-back-and-forward.
        } else {
          // Course/rotation/category groups — every item is auto-selected.
          const allItems: any[] = [];
          g.forEach(grp => grp.items.forEach((it: any) => {
            allItems.push({
              id: String(it.id),
              name: it.name,
              course: grp.title,
              description: it.description,
              price: it.price ? Number(it.price) : undefined,
              image_url: it.image_url,
            });
          }));
          update({ selectedMenuItems: allItems });
        }
      } catch { } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuType, cuisineIds, budgetId, eventId]);

  // Tabbed menus: when active tab changes, replace selectedMenuItems with
  // only that menu's items (web AmericanMenuSelection.useEffect on activeMenuId).
  useEffect(() => {
    if (!isTabbed || activeTabId === null) return;
    const active = groups.find(g => g.id === activeTabId);
    if (!active) return;
    update({
      selectedMenuItems: active.items.map((it: any) => ({
        id: String(it.id),
        name: it.name,
        course: it.category || active.title,
        description: it.description,
        price: it.price ? Number(it.price) : undefined,
        image_url: it.image_url,
      })),
    });
  }, [activeTabId, groups, isTabbed]);

  // Group selected items by section for the summary panel
  const groupedSelected = st.selectedMenuItems.reduce((acc, it) => {
    if (!acc[it.course]) acc[it.course] = [];
    acc[it.course].push(it);
    return acc;
  }, {} as Record<string, typeof st.selectedMenuItems>);

  // Step number on the circle: 6 if the user went through Cuisine (Buffet /
  // Set Menu / American), 5 otherwise. Mirrors the web — Coffee Break /
  // Platter / Live Station / Canape / Ramadan / Iftar Boxes show "5".
  const wentThroughCuisine = sm(st.selectedServiceStyles?.name, 'buffet', 'set menu');
  const menuStepNum = wentThroughCuisine ? 6 : 5;

  // Platter has a special subtitle line under the title (not part of the
  // generic "package" subtitle).
  const isPlatter = menuType === 'platters';
  const isCanape = menuType === 'canape';
  const isToggleable = TOGGLEABLE_MENUS.has(menuType);

  // Canape: limits depend on the budget tier; we use them for the banner,
  // per-category counters, and tap-to-add gating.
  const canapeConstraints = isCanape ? getCanapeConstraints(st.selectedBudget?.price_range) : null;
  const limitForCanapeCategory = (category: string): number => {
    if (!canapeConstraints) return 999;
    if (category.includes('Cold Beverages')) return canapeConstraints.coldBev;
    if (category.includes('Hot Beverages'))  return canapeConstraints.hotBev;
    return canapeConstraints.food;
  };

  // Re-order canape groups into the canonical web order
  const orderedGroups = isCanape
    ? [...groups].sort((a, b) => {
        const ai = CANAPE_CATEGORY_ORDER.indexOf(a.title);
        const bi = CANAPE_CATEGORY_ORDER.indexOf(b.title);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
    : groups;

  // Toggle handler for non-tabbed, non-auto-select menus
  const toggleItem = (item: any, courseLabel: string) => {
    const idPrefix =
      menuType === 'platters'    ? 'platter-' :
      menuType === 'liveStation' ? 'live-'    :
      menuType === 'canape'      ? 'canape-'  :
      '';
    const itemId = `${idPrefix}${item.id}`;
    const exists = st.selectedMenuItems.some(s => s.id === itemId);
    if (exists) {
      update({ selectedMenuItems: st.selectedMenuItems.filter(s => s.id !== itemId) });
      return;
    }
    // Canape: gate on per-category limit. Silently no-op once we hit it
    // (web's CanapeMenu prunes on the validation effect; same intent.)
    if (isCanape) {
      const inCategory = st.selectedMenuItems.filter(i => i.course === courseLabel).length;
      if (inCategory >= limitForCanapeCategory(courseLabel)) return;
    }
    update({
      selectedMenuItems: [...st.selectedMenuItems, {
        id: itemId,
        name: item.name,
        course: courseLabel,
        description: item.description,
        price: item.price ? Number(item.price) : undefined,
        image_url: item.image_url,
      } as any],
    });
  };

  const isRamadan    = menuType === 'ramadan';
  const isIftarBoxes = menuType === 'iftarBoxes';

  return (
    <>
      <View style={bs.card}>
        <View style={bs.cardHeader}>
          <StepCircle n={menuStepNum} />
          {/* Ramadan/Iftar Boxes show the dynamic menu name when loaded */}
          <Text style={bs.cardTitle}>
            {(isRamadan || isIftarBoxes) && menuName ? menuName : MENU_TITLES[menuType]}
          </Text>
        </View>

        {isPlatter ? (
          <Text style={cm.subtitle}>{PLATTER_SUBLINE}</Text>
        ) : (isRamadan && menuDescription) ? (
          <Text style={cm.subtitle}>{menuDescription}</Text>
        ) : isIftarBoxes ? (
          <Text style={cm.subtitle}>This is the menu for your selected budget.</Text>
        ) : (
          MENU_SUBTITLES[menuType] ? (
            <Text style={cm.subtitle}>{MENU_SUBTITLES[menuType]}</Text>
          ) : null
        )}

        {/* Iftar Boxes: just the menu image (no item grid) */}
        {isIftarBoxes && !loading && (
          iftarBoxImage ? (
            <View style={cm.iftarImgWrap}>
              <Image source={{ uri: iftarBoxImage }} style={cm.iftarImg} contentFit="contain" />
            </View>
          ) : (
            <View style={cm.emptyBox}>
              <Text style={cm.emptyText}>No menu image available for this budget.</Text>
            </View>
          )
        )}

        {/* Canape — instruction banner showing per-budget limits */}
        {isCanape && canapeConstraints && (
          <View style={cm.canapeBanner}>
            <Text style={cm.canapeBannerTitle}>
              Based on your budget ({st.selectedBudget?.price_range || ''}):
            </Text>
            <Text style={cm.canapeBannerLine}>
              • Choose <Text style={{ fontWeight: '700' }}>{canapeConstraints.food}</Text> from each Food Category (Cold, Hot, Arabic, Sweet, Vegetarian)
            </Text>
            <Text style={cm.canapeBannerLine}>
              • Choose <Text style={{ fontWeight: '700' }}>{canapeConstraints.coldBev}</Text> Cold Beverage(s)
            </Text>
            <Text style={cm.canapeBannerLine}>
              • Choose <Text style={{ fontWeight: '700' }}>{canapeConstraints.hotBev}</Text> Hot Beverage(s)
            </Text>
          </View>
        )}

        {loading ? <Shimmer /> : isIftarBoxes ? null : isTabbed ? (
          // ── Tabbed mode (American / Ramadan / Iftar Boxes) ─────────────
          <>
            {/* Horizontal tab strip — web: flex overflow-x-auto gap-3 mb-8.
                Coffee Break uses rounded-full pills with "Start: " prefix +
                a check mark when active (matches web CoffeeBreakMenu). */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={cm.tabRow}>
              {groups.map(g => {
                const active = activeTabId === g.id;
                const usePill = ROTATION_PREFIX_MENUS.has(menuType);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      usePill ? cm.pillBtn : cm.tabBtn,
                      active && (usePill ? cm.pillBtnActive : cm.tabBtnActive),
                    ]}
                    onPress={() => setActiveTabId(g.id)}
                    activeOpacity={0.85}>
                    <View style={cm.tabContent}>
                      <Text
                        style={[
                          cm.tabBtnText,
                          active && cm.tabBtnTextActive,
                          active && usePill && { fontWeight: '700' },
                        ]}
                        numberOfLines={1}>
                        {usePill ? `Start: ${g.title}` : g.title}
                      </Text>
                      {usePill && active && (
                        <Check size={14} color={Colors.neutralWhite} style={{ marginLeft: 6 }} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Items of the active menu — grouped by `category` */}
            {(() => {
              const active = groups.find(g => g.id === activeTabId);
              if (!active) return null;
              const byCategory: Record<string, any[]> = {};
              active.items.forEach((it: any) => {
                const cat = it.category || active.title;
                if (!byCategory[cat]) byCategory[cat] = [];
                byCategory[cat].push(it);
              });
              return (
                <View style={{ gap: 24 }}>
                  {Object.entries(byCategory).map(([cat, items]) => (
                    <View key={cat}>
                      <Text style={cm.courseTitle}>{cat}</Text>
                      <View style={{ gap: 12 }}>
                        {items.map((item: any) => (
                          <View key={item.id} style={cm.itemCard}>
                            <View style={cm.imgWrap}>
                              {item.image_url ? (
                                <Image source={{ uri: item.image_url }} style={cm.img} contentFit="cover" />
                              ) : (
                                <View style={[cm.img, { backgroundColor: '#E5E7EB' }]} />
                              )}
                              <View style={cm.addedBadge}>
                                <Text style={cm.addedBadgeText}>ADDED</Text>
                              </View>
                            </View>
                            <Text style={cm.itemName}>{item.name}</Text>
                            <Text style={cm.itemDesc} numberOfLines={3}>
                              {item.description || 'Delicious option for your event.'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}
          </>
        ) : (
          // ── Standard mode (course-grouped) ─────────────────────────────
          <View style={{ gap: 24 }}>
            {orderedGroups.map(group => {
              // Canape: course label appends " Canape" so the booking summary
              // groups items under "Cold Canape" / "Hot Beverages Canape" etc.
              const courseLabelForGroup =
                menuType === 'platters'    ? 'Platter'                :
                menuType === 'liveStation' ? 'Live Station'           :
                menuType === 'canape'      ? `${group.title} Canape`  :
                group.title;
              const canapeSelectedInCat = isCanape
                ? st.selectedMenuItems.filter(i => i.course === courseLabelForGroup).length
                : 0;
              const canapeLimit = isCanape ? limitForCanapeCategory(courseLabelForGroup) : 0;

              return (
              <View key={group.id}>
                {isCanape ? (
                  <View style={cm.canapeCatHeader}>
                    <Text style={cm.canapeCatTitle}>{group.title} Canapes</Text>
                    <Text style={cm.canapeCatCounter}>
                      Selected: {canapeSelectedInCat} / {canapeLimit}
                    </Text>
                  </View>
                ) : menuType === 'liveStation' ? (
                  // Live Station: the group key is `item.setup`, which is
                  // already rendered inside each card under the "SETUP:"
                  // block — skip the redundant section header.
                  null
                ) : (
                  <Text style={cm.courseTitle}>{group.title}</Text>
                )}
                <View style={isCanape ? cm.canapeGrid : { gap: 12 }}>
                  {group.items.map((item: any) => {
                    const courseLabel = courseLabelForGroup;
                    const itemIdPrefix =
                      menuType === 'platters'    ? 'platter-' :
                      menuType === 'liveStation' ? 'live-'    :
                      menuType === 'canape'      ? 'canape-'  :
                      '';
                    const itemId = isToggleable
                      ? `${itemIdPrefix}${item.id}`
                      : String(item.id);
                    const isSelected = isToggleable
                      ? st.selectedMenuItems.some(s => s.id === itemId)
                      : true;

                    const Card: any = isToggleable ? TouchableOpacity : View;
                    const isLiveStation = menuType === 'liveStation';

                    return (
                      <Card
                        key={item.id}
                        style={[
                          cm.itemCard,
                          isCanape && cm.canapeItemCard,
                          isToggleable && !isSelected && cm.itemCardInactive,
                        ]}
                        {...(isToggleable
                          ? { onPress: () => toggleItem(item, courseLabel), activeOpacity: 0.85 }
                          : {})}>
                        <View style={cm.imgWrap}>
                          <MenuCardImage
                            uri={item.image_url}
                            fallback={FALLBACK_LABEL[menuType] || 'Item'}
                          />
                          {isSelected && (
                            <View style={cm.addedBadge}>
                              <Text style={cm.addedBadgeText}>
                                {isRamadan ? 'INCLUDED' : 'ADDED'}
                              </Text>
                            </View>
                          )}
                        </View>

                        {isLiveStation ? (
                          // Live Station card: name + price-per-head row, then
                          // Setup + Ingredients labelled blocks (web LiveStationMenu)
                          <>
                            <View style={cm.lsHeaderRow}>
                              <Text style={[cm.itemName, { fontSize: 17 }]}>{item.name}</Text>
                              {item.price ? (
                                <Text style={cm.lsPrice}>{item.price} AED / per head</Text>
                              ) : null}
                            </View>
                            {item.setup ? (
                              <View style={{ marginTop: 4 }}>
                                <Text style={cm.lsLabel}>SETUP:</Text>
                                <Text style={cm.lsValue}>{item.setup}</Text>
                              </View>
                            ) : null}
                            {item.ingredients ? (
                              <View style={{ marginTop: 6 }}>
                                <Text style={cm.lsLabel}>INGREDIENTS:</Text>
                                <Text style={cm.lsValue}>{item.ingredients}</Text>
                              </View>
                            ) : null}
                          </>
                        ) : isCanape ? (
                          // Canape: keep the item name as a heading but skip
                          // the description blurb below it.
                          <Text style={cm.itemName}>{item.name}</Text>
                        ) : (
                          <>
                            <Text style={cm.itemName}>{item.name}</Text>
                            <Text style={cm.itemDesc} numberOfLines={3}>
                              {item.description || 'Delicious option for your event.'}
                            </Text>
                            {/* Ramadan items can carry a quantity */}
                            {isRamadan && item.quantity > 1 && (
                              <Text style={cm.qtyText}>Qty: {item.quantity}</Text>
                            )}
                          </>
                        )}
                      </Card>
                    );
                  })}
                </View>
              </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Selected Items panel (replaces web's right-rail sidebar on mobile) */}
      <View style={cm.summaryCard}>
        <Text style={cm.summaryTitle}>Selected Items</Text>
        {Object.keys(groupedSelected).length === 0 ? (
          <Text style={cm.summaryEmpty}>No items selected yet.</Text>
        ) : (
          <View style={{ gap: 16 }}>
            {Object.entries(groupedSelected).map(([course, items]) => (
              <View key={course}>
                <Text style={cm.summaryCourseLabel}>{course}</Text>
                {items.map(it => (
                  <Text key={it.id} style={cm.summaryItem}>{it.name}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[bs.contBtn, { marginTop: 20, height: 48 }, !st.selectedMenuItems.length && bs.contBtnDisabled]}
          disabled={!st.selectedMenuItems.length}
          onPress={onNext}
          activeOpacity={0.85}>
          <Text style={bs.contBtnText}>Review Catering Service</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[bs.backBtn, { marginTop: 10, height: 48 }]}
          onPress={onBack}
          activeOpacity={0.85}>
          <Text style={bs.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

// ── Step 8: Booking Summary ───────────────────────────────────────────────────
const Step8Summary = ({ st, update, onBack }: StepProps) => {
  const navigation  = useNavigation<any>();
  const [loading, setLoading]   = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // calculateTotal — identical to web BookingSummary.calculateTotal()
  const calculateTotal = () => {
    const isPlatters   = sm(st.selectedServiceStyles?.name, 'platter');
    const isLive       = sm(st.selectedServiceStyles?.name, 'live station');
    const g            = st.guestCount;

    if (isPlatters) {
      const price     = st.selectedBudget?.price_range ? parseFloat(st.selectedBudget.price_range.replace('AED', '').trim()) : 0;
      const baseTotal = price * st.selectedMenuItems.length * g;
      return { baseTotal, vat: baseTotal * 0.15, total: baseTotal + baseTotal * 0.15 };
    }
    if (isLive) {
      const perPax    = st.selectedMenuItems.reduce((s, i) => s + (Number(i.price) || 0), 0);
      const baseTotal = g * perPax;
      return { baseTotal, vat: baseTotal * 0.15, total: baseTotal + baseTotal * 0.15 };
    }
    const pricePerGuest = st.selectedBudget?.price_range
      ? parseFloat(st.selectedBudget.price_range.replace('AED', '').trim()) : 70;
    const baseTotal = g * pricePerGuest;
    return { baseTotal, vat: baseTotal * 0.15, total: baseTotal + baseTotal * 0.15 };
  };

  const { baseTotal, vat, total } = calculateTotal();

  const handleConfirmAndPay = async () => {
    const token = await getAuthToken();
    if (!token) { setShowAuth(true); return; }
    setLoading(true);
    try {
      // Parse the formatted selectedDateTime ("Day, Month, Year - HH:MM")
      // back into ISO date + 24h time, identical to web BookingSummary.
      let eventDate = new Date().toISOString().split('T')[0];
      let eventTime = '12:00:00';
      if (st.selectedDateTime) {
        try {
          const [datePart, timePart] = st.selectedDateTime.split(' - ');
          const [d, monthName, y]    = datePart.split(', ');
          const monthIdx             = MONTH_NAMES.indexOf(monthName) + 1;
          if (monthIdx > 0) {
            eventDate = `${y}-${String(monthIdx).padStart(2, '0')}-${String(parseInt(d)).padStart(2, '0')}`;
          }
          if (timePart && /^\d{1,2}:\d{2}$/.test(timePart.trim())) {
            eventTime = `${timePart.trim()}:00`;
          }
        } catch { /* fall back to defaults above */ }
      }

      const orderData: any = {
        event_type:    st.selectedEvent?.name || 'Unknown',
        guest_count:   st.guestCount,
        event_date:    eventDate,
        event_time:    eventTime,
        provider_type: st.selectedProvider?.name || '',
        service_style: st.selectedServiceStyles?.name || '',
        location:      st.selectedLocation?.name || '',
        total_amount:  total,
        items:         st.selectedMenuItems.map(i => ({ name: i.name, course: i.course, quantity: 1, price: i.price || 0, description: i.description || '' })),
        extraDetails:  { cuisines: st.selectedCuisines, courses: st.selectedCourses, budget: st.selectedBudget, menuItems: st.selectedMenuItems, pricing: { baseTotal, vat, total } },
      };
      await setPendingCateringOrder(orderData);

      const returnUrl = `dosta://catering/plan?payment_success=true`;
      const payRes = await fetch(`${BASE_URL}/api/vending/payment/initiate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({
          amount:       total,
          description:  `Catering: ${orderData.event_type} (${st.guestCount} guests)`,
          success_url:  returnUrl,
          cancel_url:   'dosta://catering/plan?payment_cancelled=true',
        }),
      });
      if (payRes.ok) {
        const pd = await payRes.json();
        if (pd.payment_redirect_url) { await Linking.openURL(pd.payment_redirect_url); return; }
      }
      Alert.alert('Error', 'Failed to initiate payment. Please try again.');
    } catch { Alert.alert('Error', 'An error occurred. Please try again.'); }
    finally { setLoading(false); }
  };

  // Group menu items by course (identical to web)
  const groupedItems = st.selectedMenuItems.reduce((acc, item) => {
    if (!acc[item.course]) acc[item.course] = [];
    acc[item.course].push(item);
    return acc;
  }, {} as Record<string, typeof st.selectedMenuItems>);

  const getCourseOrder = (course: string) => {
    const l = course.toLowerCase();
    if (l.includes('salad'))    return 10;
    if (l.includes('cold app')) return 20;
    if (l.includes('hot app'))  return 30;
    if (l.includes('starter') || l.includes('appetizer')) return 40;
    if (l.includes('soup'))     return 50;
    if (l.includes('main'))     return 100;
    if (l.includes('dessert'))  return 110;
    if (l.includes('beverage') || l.includes('drink')) return 120;
    return 60;
  };
  const sortedCourses = Object.keys(groupedItems).sort((a, b) => getCourseOrder(a) - getCourseOrder(b));

  return (
    <>
      {/* LEFT: Event details card */}
      <View style={bs.summaryDetailCard}>
        {/* Event Type */}
        <View style={bs.summarySection}>
          <Text style={bs.summarySectionLabel}>Event Type:</Text>
          <Text style={bs.summarySectionValue}>{st.selectedEvent?.name || 'Not Selected'}</Text>
          <Text style={bs.summarySectionValue}>{st.guestCount} Guests</Text>
          <Text style={bs.summarySectionValue}>{st.selectedDateTime || 'Not Selected'}</Text>
        </View>

        {/* Service Style */}
        <View style={bs.summarySection}>
          <Text style={bs.summarySectionLabel}>Service Style:</Text>
          <Text style={bs.summarySectionValue}>{st.selectedServiceStyles?.name || 'Not Selected'}</Text>
          {(st.selectedServiceStyles?.description) && (
            <>
              <Text style={[bs.summarySectionLabel, { marginTop: 12 }]}>Description:</Text>
              <Text style={bs.noteText}>{st.selectedServiceStyles.description}</Text>
            </>
          )}
        </View>

        {/* Cuisines */}
        <View style={bs.summarySection}>
          <Text style={bs.summarySectionLabel}>Cuisines:</Text>
          <Text style={bs.summarySectionValue}>
            {st.selectedCuisines.length > 0 ? st.selectedCuisines.map(c => c.name).join(', ') : 'Not Selected'}
          </Text>
        </View>

        {/* Location */}
        <View style={bs.summarySection}>
          <Text style={bs.summarySectionLabel}>Location</Text>
          <Text style={bs.summarySectionValue}>{st.selectedLocation?.name || 'Not Selected'}</Text>
        </View>

        {/* Budget */}
        <View style={bs.summarySection}>
          <Text style={bs.summarySectionLabel}>Budget:</Text>
          <Text style={bs.summarySectionValue}>
            {st.selectedBudget?.label || 'Not Selected'}
            {st.selectedBudget?.price_range ? ` - ${st.selectedBudget.price_range}` : ''}
          </Text>
        </View>

        {/* Menu Items */}
        <View style={bs.summarySection}>
          <Text style={bs.summarySectionLabel}>Menu Items:</Text>
          {sm(st.selectedServiceStyles?.name, 'iftar') && sm(st.selectedServiceStyles?.name, 'box') ? (
            <Text style={bs.summarySectionValue}>Iftar Boxes Menu</Text>
          ) : st.selectedMenuItems.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              {sortedCourses.map(course => (
                <View key={course} style={{ marginBottom: 12 }}>
                  <Text style={[bs.summarySectionValue, { fontWeight: '700' }]}>{course}</Text>
                  {groupedItems[course].map(item => (
                    <View key={item.id}>
                      <Text style={[bs.noteText, { fontWeight: '600' }]}>{item.name}</Text>
                      {item.description ? <Text style={bs.noteText}>{item.description}</Text> : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <Text style={bs.summarySectionValue}>Not Selected</Text>
          )}
        </View>

        <TouchableOpacity style={bs.backBtn} onPress={onBack}>
          <Text style={bs.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>

      {/* RIGHT: Booking Summary card */}
      <View style={bs.summaryPriceCard}>
        <Text style={bs.summaryPriceTitle}>Booking Summary</Text>

        <View style={{ gap: 12, marginBottom: 24 }}>
          {/* Per-item rows for Platter & Live Station; single guest row otherwise */}
          {(() => {
            const styleName = (st.selectedServiceStyles?.name || '').toLowerCase();
            const isPlatters = styleName.includes('platter');
            const isLive     = styleName.includes('live station');

            if (isPlatters || isLive) {
              return (
                <>
                  {st.selectedMenuItems.map((item) => {
                    // Platter pricing = budget price (per platter, serves N).
                    // Live Station pricing = item.price.
                    const price = isPlatters
                      ? (st.selectedBudget?.price_range
                          ? parseFloat(st.selectedBudget.price_range.replace('AED', '').trim())
                          : 0)
                      : (Number(item.price) || 0);
                    const itemTotal = price * st.guestCount;
                    return (
                      <View
                        key={item.id}
                        style={[bs.priceRow, { alignItems: 'flex-start', flexWrap: 'wrap' }]}>
                        {/* Web: name + parens wrap to a second line when the
                            screen is narrow. Drop `numberOfLines` so RN can
                            break "(60 x N)" onto its own line. */}
                        <Text style={[bs.priceLbl, { flex: 1, marginRight: 8 }]}>
                          {item.name}{'\n'}({price} x {st.guestCount})
                        </Text>
                        <Text style={bs.priceVal}>AED{itemTotal.toFixed(2)}</Text>
                      </View>
                    );
                  })}
                  {/* thin divider before VAT — web uses border-t */}
                  <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 }} />
                </>
              );
            }
            return (
              <View style={bs.priceRow}>
                <Text style={bs.priceLbl}>Guest x{st.guestCount}</Text>
                <Text style={bs.priceVal}>AED{baseTotal.toFixed(2)}</Text>
              </View>
            );
          })()}

          {/* VAT */}
          <View style={bs.priceRow}>
            <Text style={bs.priceLbl}>VAT</Text>
            <Text style={bs.priceVal}>AED{vat.toFixed(2)}</Text>
          </View>
          {/* Total */}
          <View style={[bs.priceRow, { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}>
            <Text style={[bs.priceLbl, { fontSize: 16, fontWeight: '400', color: Colors.neutralBlack }]}>
              Total (VAT incl.)
            </Text>
            <Text style={[bs.priceVal, { fontSize: 16, fontWeight: '700', color: Colors.primary }]}>
              AED{total.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          {/* Confirm & Pay */}
          <TouchableOpacity style={[bs.contBtn, { marginTop: 0, height: 44 }]} onPress={handleConfirmAndPay} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={bs.contBtnText}>Confirm &amp; Pay</Text>}
          </TouchableOpacity>
          {/* Request Custom Quote */}
          <TouchableOpacity
            style={[bs.backBtn, { height: 44 }]}
            onPress={() => navigation.navigate('RequestCustomQuote')}>
            <Text style={bs.backBtnText}>Request Custom Quote</Text>
          </TouchableOpacity>
        </View>
      </View>

      <AuthPromptModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        message="Please log in to confirm your catering booking. Don't have an account? Sign up for free!"
        returnTo={{ name: 'CateringPlan' }}
      />
    </>
  );
};

// ── Step label map ────────────────────────────────────────────────────────────
const STEP_LABELS: Record<number, string> = {
  1:'Event Type', 2:'Location', 3:'Service Style', 4:'Cuisine',
  5:'Budget & Guests', 7:'Menu', 8:'Booking Summary',
  9:'Coffee Break Menu', 10:'Platter Menu', 12:'Live Station Menu',
  13:'American Menu', 14:'Canape Menu', 15:'Ramadan Menu', 16:'Iftar Boxes',
};

function menuTypeForStep(step: number, st: WizardState): string {
  const s = (st.selectedServiceStyles?.name || '').toLowerCase();
  if (step === 7)  return 'courses';
  if (step === 9)  return 'coffeeBreak';
  if (step === 10) return 'platters';
  if (step === 12) return 'liveStation';
  if (step === 13) return 'american';
  if (step === 14) return 'canape';
  if (step === 15) return 'ramadan';
  if (step === 16) return 'iftarBoxes';
  return 'courses';
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CateringPlanScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const [step, setStep]  = useState(1);
  const [st,   setSt]    = useState<WizardState>(INIT);
  // Async restore from storage races with the user's first tap. We gate the
  // persist effect on `restored` so it can't write stale INIT state, and we
  // only apply the restore if the user hasn't already started interacting.
  const [restored, setRestored] = useState(false);
  const update = useCallback((p: Partial<WizardState>) => setSt(prev => ({ ...prev, ...p })), []);

  // Persist wizard — only AFTER restore has run, otherwise we'd overwrite
  // saved data with the initial INIT state on every fresh mount.
  useEffect(() => {
    if (!restored) return;
    storage.setJSON('guestCateringOrder', { ...st, step });
  }, [step, st, restored]);

  // Restore on mount
  useEffect(() => {
    storage.getJSON<any>('guestCateringOrder').then(saved => {
      if (saved) {
        // `step` lives in storage but isn't a WizardState field — strip it
        // so the spread doesn't bolt a junk property onto `st`.
        const { step: savedStep, ...wizardOnly } = saved;
        setSt(prev => (prev === INIT ? { ...prev, ...wizardOnly } : prev));
        setStep(prev => (prev === 1 && savedStep ? savedStep : prev));
      }
      setRestored(true);
    });
  }, []);

  // Payment return deep link
  useEffect(() => {
    if (route.params?.payment_success !== 'true') return;
    const finalize = async () => {
      const pending = await storage.getJSON<any>('pendingCateringOrder');
      if (!pending) return;
      const token = await getAuthToken();
      try {
        const res = await fetch(`${BASE_URL}/api/catering/orders/create/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
          body: JSON.stringify({ ...pending, is_payment_verified: true }),
        });
        if (res.ok) {
          const data = await res.json();
          await storage.removeItem('pendingCateringOrder');
          await storage.removeItem('guestCateringOrder');
          navigation.navigate('CateringConfirmation', { orderId: data.order_id, orderDetails: data });
        }
      } catch (e) { console.error('Catering finalization error:', e); }
    };
    finalize();
  }, [route.params]);

  const goNext = () => {
    const n = nextStep(step, st);
    if (n !== step) setStep(n);
  };
  const goBack = () => {
    const p = prevStep(step, st);
    if (p !== step) {
      if (step === 3) update({ selectedProvider: null, selectedServiceStyles: null, selectedDetailedEventName: null });
      if (step === 5) update({ selectedBudget: INIT.selectedBudget, selectedPax: INIT.selectedPax });
      // Stepping back from any menu step — clear menu items so the next entry
      // starts fresh. Without this the Booking Summary's "Selected Items"
      // panel keeps showing the old budget's items until the new fetch lands.
      if ([7, 9, 10, 12, 13, 14, 15, 16].includes(step)) update({ selectedMenuItems: [] });
      setStep(p);
    }
  };

  const stepProps: StepProps = { st, update, onNext: goNext, onBack: goBack };

  return (
    <View style={[scrn.screen, { paddingTop: insets.top }]}>
      <Header variant="catering" />

      {/* Page header */}
      <View style={scrn.titleArea}>
        <BreadCrumb />
        <Text style={scrn.pageTitle}>{STEP_LABELS[step] || `Step ${step}`}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {step === 1  && <Step1EventType    {...stepProps} />}
        {step === 2  && <Step2Location     {...stepProps} />}
        {step === 3  && <Step3Provider     {...stepProps} />}
        {step === 4  && <Step4Cuisine      {...stepProps} />}
        {step === 5  && (
          <Step5Budget
            key={`step5-${st.selectedServiceStyles?.id ?? ''}-${st.selectedCuisines.map(c => c.id).join(',')}-${st.selectedEvent?.id ?? ''}`}
            {...stepProps}
          />
        )}
        {/* Key on budget+cuisine forces a fresh mount when the user goes
            back and changes the budget — guarantees a re-fetch even if
            React would otherwise reuse the existing component instance. */}
        {step === 7  && (
          <Step7CoursesMenu
            key={`step7-${st.selectedBudget?.id ?? ''}-${st.selectedCuisines.map(c => c.id).join(',')}`}
            {...stepProps}
          />
        )}
        {[9,10,12,13,14,15,16].includes(step) && (
          <StepMenu
            key={`menu-${step}-${st.selectedBudget?.id ?? ''}-${st.selectedCuisines.map(c => c.id).join(',')}`}
            {...stepProps}
            menuType={menuTypeForStep(step, st)}
          />
        )}
        {step === 8  && <Step8Summary      {...stepProps} />}
      </ScrollView>

      <MobileFooterNav />
    </View>
  );
}

// ── Shared base styles ────────────────────────────────────────────────────────
const bs = StyleSheet.create({
  // Card container — bg-neutral-white border border-[#EDEEF2] rounded-2xl
  card:         { backgroundColor: Colors.neutralWhite, borderRadius: 16, borderWidth: 1, borderColor: Colors.neutralGrayLightest, padding: 14, marginBottom: 16 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  cardTitle:    { fontSize: 18, fontWeight: '700', color: Colors.neutralBlack, flex: 1, lineHeight: 24 },
  // Step circle — bg-primary w-8 h-8 rounded-full
  stepCircle:   { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepCircleText:{ color: Colors.neutralWhite, fontWeight: '700', fontSize: 13 },
  // Sub-sections
  subSection:   { marginTop: 20 },
  subHeader:    { fontSize: 15, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 12 },
  noteText:     { fontSize: 13, fontWeight: '400', color: Colors.neutralGrayDark, marginBottom: 6 },
  // Option buttons — full width on mobile (web's grid-cols-1 default at <md)
  optBtn:       { width: '100%', minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: Colors.neutralGrayLight, backgroundColor: Colors.neutralWhite, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  optBtnActive: { backgroundColor: '#EAF5FF', borderColor: Colors.primary },
  optBtnDisabled:{ backgroundColor: '#F5F5F5', opacity: 0.7 },
  optBtnText:   { fontSize: 15, fontWeight: '600', color: Colors.neutralBlack, textAlign: 'center' },
  optBtnSubText:{ fontSize: 12, fontWeight: '500', color: Colors.neutralGrayDark, marginTop: 4, textAlign: 'center' },
  optBtnTextActive:  { color: Colors.primary },
  optBtnTextDisabled:{ color: '#A0A0A0' },
  optBtnImage:       { width: 56, height: 56, borderRadius: 12, marginRight: 12, backgroundColor: '#F3F4F6' },
  // Inline tooltip — appears under a disabled button when the user taps it
  tipBubble:         { marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1F2937' },
  tipBubbleText:     { color: Colors.neutralWhite, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  // Option list — single column, identical width buttons
  optGrid:      { flexDirection: 'column', gap: 10 },
  // Event grid (2 columns) — `width: '48%'` on the card pairs with
  // `space-between` so two cards always share the row regardless of device.
  eventGrid:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  // Guest counter
  guestRow:     { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  guestBtn:     { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EAF5FF', alignItems: 'center', justifyContent: 'center' },
  guestBtnText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  guestInput:   { width: 94, height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.neutralGrayLight, textAlign: 'center', fontSize: 16, color: Colors.neutralBlack },
  // Navigation row — justify-between
  navRow:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32, gap: 12 },
  backBtn:      { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.neutralWhite, alignItems: 'center' },
  backBtnText:  { fontSize: 14, fontWeight: '700', color: Colors.primary },
  contBtn:      { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  // Swapping background colour (instead of toggling opacity) gives a crisp,
  // single-frame visual change. Opacity transitions could appear "stuck" on
  // some Android devices, making users tap a second time before the button
  // looked enabled — even though it was already clickable.
  contBtnDisabled:{ backgroundColor: '#9CA3AF' },
  contBtnText:  { fontSize: 14, fontWeight: '700', color: Colors.neutralWhite, letterSpacing: 0.3 },
  // Menu item rows
  menuItem:     { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.neutralGrayLightest, backgroundColor: Colors.neutralWhite, marginBottom: 8, gap: 12 },
  menuItemActive:{ borderColor: Colors.primary, backgroundColor: '#EAF5FF' },
  menuItemImg:  { width: 60, height: 60, borderRadius: 8 },
  menuItemName: { fontSize: 14, fontWeight: '600', color: Colors.neutralBlack },
  menuItemDesc: { fontSize: 12, color: Colors.neutralGray, lineHeight: 16, marginTop: 2 },
  menuItemPrice:{ fontSize: 13, fontWeight: '700', color: Colors.primary, marginTop: 4 },
  checkCircle:  { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkMark:    { color: Colors.neutralWhite, fontSize: 12, fontWeight: '700' },
  // Booking Summary
  summaryDetailCard:{ backgroundColor: Colors.neutralWhite, borderRadius: 16, borderWidth: 1, borderColor: Colors.neutralGrayLightest, padding: 24, marginBottom: 16 },
  summarySection:   { marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: Colors.neutralGrayLightest },
  summarySectionLabel:{ fontSize: 24, fontWeight: '700', color: Colors.neutralGrayDark, marginBottom: 4 },
  summarySectionValue:{ fontSize: 16, fontWeight: '700', color: Colors.primaryBlue, marginBottom: 2 },
  summaryPriceCard: { backgroundColor: Colors.neutralWhite, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 24, marginBottom: 16 },
  summaryPriceTitle:{ fontSize: 28, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 24 },
  priceRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  priceLbl:     { fontSize: 14, fontWeight: '400', color: Colors.neutralGrayDark },
  priceVal:     { fontSize: 14, fontWeight: '600', color: Colors.neutralBlack },
});

const scrn = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: Colors.background },
  titleArea:  { backgroundColor: Colors.neutralWhite, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, borderBottomWidth: 1, borderBottomColor: Colors.neutralGrayLightest },
  pageTitle:  { fontSize: 24, color: Colors.primary, fontWeight: '700' },
});

const cm = StyleSheet.create({
  subtitle:           { fontSize: 14, fontWeight: '700', color: Colors.neutralGray, marginBottom: 16, lineHeight: 20 },
  courseTitle:        { fontSize: 18, fontWeight: '600', color: Colors.neutralBlack, marginBottom: 12 },
  // Web: p-3 rounded-2xl border-2 border-[#054A86] bg-[#F5F9FF]
  itemCard:           { backgroundColor: '#F5F9FF', borderRadius: 16, borderWidth: 2, borderColor: Colors.primary, padding: 12 },
  // Toggleable cards in their unselected state — neutral border + white bg
  itemCardInactive:   { backgroundColor: Colors.neutralWhite, borderColor: '#EBEBEB', borderWidth: 1 },
  // Web: relative aspect-[4/3] rounded-xl overflow-hidden mb-3 bg-gray-200
  imgWrap:            { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#E5E7EB', borderRadius: 12, overflow: 'hidden', position: 'relative', marginBottom: 12 },
  img:                { width: '100%', height: '100%' },
  // Fallback shown when an item has no image_url or the remote URL errors —
  // light grey panel with a centered grey label (e.g. "Canape").
  imgFallback:        { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  imgFallbackText:    { fontSize: 22, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.3 },
  // Web: absolute top-0 left-0 bg-[#8BC34A] h-8 w-[75px] rounded-br-[12px] text-[10px] font-bold
  addedBadge:         { position: 'absolute', top: 0, left: 0, height: 32, width: 75, backgroundColor: '#8BC34A', alignItems: 'center', justifyContent: 'center', borderBottomRightRadius: 12 },
  addedBadgeText:     { color: Colors.primaryDark, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  // Web: font-bold text-[#2B2B43] text-base mb-1
  itemName:           { fontSize: 16, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 4 },
  // Web: text-neutral-gray text-[14px] leading-[20px] font-[400]
  itemDesc:           { fontSize: 14, fontWeight: '400', color: Colors.neutralGray, lineHeight: 20 },
  summaryCard:        { backgroundColor: Colors.neutralWhite, borderRadius: 16, borderWidth: 1, borderColor: '#EDEEF2', padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  summaryTitle:       { fontSize: 18, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 16 },
  summaryEmpty:       { fontSize: 13, color: '#9CA3AF' },
  summaryCourseLabel: { fontSize: 13, fontWeight: '700', color: Colors.neutralGrayDark, marginBottom: 4 },
  summaryItem:        { fontSize: 14, fontWeight: '600', color: Colors.neutralBlack, lineHeight: 22 },
  // Horizontal tab strip — mirrors web "flex overflow-x-auto gap-3 mb-8 pb-2"
  tabRow:             { gap: 10, paddingBottom: 8, paddingRight: 12, marginBottom: 20 },
  // Web American/Ramadan: px-5 py-3 rounded-xl border
  tabBtn:             { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: Colors.neutralWhite },
  tabBtnActive:       { backgroundColor: Colors.primary, borderColor: Colors.primary, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabBtnText:         { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  tabBtnTextActive:   { color: Colors.neutralWhite },
  tabContent:         { flexDirection: 'row', alignItems: 'center' },
  // Coffee Break — web: px-4 py-2 rounded-full pills with hint of shadow on active
  pillBtn:            { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#F3F4F6' },
  pillBtnActive:      { backgroundColor: Colors.primary, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  // Empty-state when API returns no items (e.g. budget incompatible with cuisine)
  emptyBox:           { paddingVertical: 32, paddingHorizontal: 16, alignItems: 'center' },
  emptyText:          { fontSize: 14, color: Colors.neutralGrayDark, textAlign: 'center', lineHeight: 20 },
  // Live Station — name + per-head price row, plus Setup/Ingredients blocks
  lsHeaderRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 },
  lsPrice:            { fontSize: 12, fontWeight: '700', color: Colors.primary, flexShrink: 0 },
  lsLabel:            { fontSize: 11, fontWeight: '600', color: Colors.neutralBlack, letterSpacing: 0.5, marginBottom: 2 },
  lsValue:            { fontSize: 13, color: Colors.neutralGray, lineHeight: 18 },
  // Canape — instruction banner + per-category counter
  canapeBanner:       { backgroundColor: '#EAF5FF', borderWidth: 1, borderColor: Colors.primary, borderRadius: 12, padding: 14, marginBottom: 16 },
  canapeBannerTitle:  { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  canapeBannerLine:   { fontSize: 13, color: Colors.primary, lineHeight: 20, marginLeft: 8 },
  canapeCatHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 6, marginBottom: 12 },
  canapeCatTitle:     { fontSize: 16, fontWeight: '600', color: Colors.neutralBlack },
  canapeCatCounter:   { fontSize: 12, fontWeight: '700', color: Colors.primary },
  // Canape — two cards per row. `width: 48%` + space-between leaves a small
  // gutter while staying tolerant of any outer padding.
  canapeGrid:         { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  canapeItemCard:     { width: '48%', padding: 8 },
  // Ramadan item qty
  qtyText:            { fontSize: 12, fontWeight: '700', color: Colors.primary, marginTop: 6 },
  // Iftar Boxes — single image render
  iftarImgWrap:       { width: '100%', minHeight: 320, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', overflow: 'hidden', marginTop: 8 },
  iftarImg:           { width: '100%', aspectRatio: 4 / 3 },
});

const dtStyles = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: Colors.neutralWhite, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  title:      { fontSize: 18, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 12, textAlign: 'center' },
  subLabel:   { fontSize: 13, fontWeight: '700', color: Colors.neutralGrayDark, marginTop: 8, marginBottom: 4 },
  actions:    { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn:  { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', backgroundColor: Colors.neutralWhite },
  cancelTxt:  { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center' },
  confirmTxt: { color: Colors.neutralWhite, fontWeight: '700', fontSize: 14 },
});
