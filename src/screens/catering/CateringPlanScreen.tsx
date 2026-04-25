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
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react-native';
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

  if (step === 1 && st.selectedEvent?.id)          return 2;
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
    return 9;
  }
  if ([9, 10, 12, 13, 14, 15, 16].includes(step)) return 5;
  return Math.max(1, step - 1);
}

// ── Shared option button (h-[60px] rounded-[16px]) ───────────────────────────
const OptionBtn = ({ label, selected, onPress, disabled, subLabel }: {
  label: string; selected: boolean; onPress: () => void;
  disabled?: boolean; subLabel?: string;
}) => (
  <TouchableOpacity
    style={[
      bs.optBtn,
      selected && bs.optBtnActive,
      disabled && bs.optBtnDisabled,
      subLabel && { height: 80 },
    ]}
    onPress={onPress}
    disabled={disabled}>
    <Text style={[bs.optBtnText, selected && bs.optBtnTextActive, disabled && bs.optBtnTextDisabled]}>
      {label}
    </Text>
    {subLabel ? (
      <Text style={[bs.optBtnSubText, selected && bs.optBtnTextActive, disabled && bs.optBtnTextDisabled]}>
        {subLabel}
      </Text>
    ) : null}
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

// ── Step interface ────────────────────────────────────────────────────────────
interface StepProps { st: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void; onBack: () => void; }

// ── Step 1: Event Type Selection ──────────────────────────────────────────────
const Step1EventType = ({ st, update, onNext, onBack }: StepProps) => {
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

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
            <EventTypeCard
              key={ev.id}
              image={ev.image_url}
              title={ev.name}
              selected={st.selectedEvent?.id === String(ev.id)}
              onPress={() => update({ selectedEvent: { id: String(ev.id), name: ev.name, description: ev.description } })}
            />
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

          <NavBtns
            onBack={onBack}
            onContinue={onNext}
            continueDisabled={!st.selectedEvent?.id}
          />
        </View>
      )}
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
        <View style={[bs.optGrid, { marginTop: 32, marginLeft: 8 }]}>
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
        <View style={[bs.subSection, { marginLeft: 8 }]}>
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
      <View style={[bs.subSection, { marginLeft: 8 }]}>
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
              return (
                <OptionBtn
                  key={style.id}
                  label={style.name}
                  selected={st.selectedServiceStyles?.id === style.id}
                  disabled={isDisabled}
                  onPress={() => !isDisabled && update({
                    selectedServiceStyles: { id: style.id, name: style.name, description: style.description, min_pax: style.min_pax },
                  })}
                />
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

      <View style={[bs.subSection, { marginLeft: 8 }]}>
        <Text style={bs.noteText}>(You can select multiple options)</Text>
        {loading ? <Shimmer /> : (
          <View style={bs.optGrid}>
            {cuisines.map(c => (
              <OptionBtn
                key={c.id}
                label={c.name}
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
const Step5Budget = ({ st, update, onNext, onBack }: StepProps) => {
  const [budgetOptions, setBudgetOptions] = useState<any[]>([]);
  const [paxOptions, setPaxOptions]       = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);

  const isBuffetOrSet = sm(st.selectedServiceStyles?.name, 'buffet', 'set menu');
  const stepNum       = isBuffetOrSet ? 5 : 4;
  const isPrivateChef = st.selectedEvent?.name?.toLowerCase().includes('private chef');
  const isPrivate     = !st.selectedEvent?.name?.toLowerCase().includes('corporate');

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const hdrs  = token ? { Authorization: `Token ${token}` } : {};
        const cuisineIds = st.selectedCuisines.map(c => c.id).join(',');
        const [budgetRes, paxRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/catering/budget-options/`, {
            headers: hdrs,
            params: {
              service_style_id: st.selectedServiceStyles?.id,
              is_private:       isPrivate,
              is_private_chef:  isPrivateChef,
              cuisine_ids:      cuisineIds,
            },
          }),
          axios.get(`${BASE_URL}/api/catering/pax/`, {
            headers: hdrs,
            params: {
              service_style_id: st.selectedServiceStyles?.id,
              is_private:       isPrivate,
              is_private_chef:  isPrivateChef,
            },
          }),
        ]);
        // Sort budget by price ascending (identical to web)
        const sorted = budgetRes.data.sort((a: any, b: any) => {
          const getPrice = (str: string) => { const m = str?.match(/\d+/); return m ? parseInt(m[0]) : 0; };
          return getPrice(a.price_range) - getPrice(b.price_range);
        });
        setBudgetOptions(sorted);
        setPaxOptions(paxRes.data);

        // Auto-select pax matching guest count (identical to web)
        const match = paxRes.data.find((p: any) => {
          const nums = p.number?.match(/\d+/g)?.map(Number) || [];
          return nums.length === 1 ? st.guestCount <= nums[0] :
                 nums.length === 2 ? st.guestCount >= nums[0] && st.guestCount <= nums[1] : false;
        });
        if (match) update({ selectedPax: { id: String(match.id), label: match.label, number: match.number } });
        else if (paxRes.data.length > 0) {
          const f = paxRes.data[0];
          update({ selectedPax: { id: String(f.id), label: f.label, number: f.number } });
        }
      } catch { } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={bs.card}>
      <View style={bs.cardHeader}>
        <StepCircle n={stepNum} />
        <Text style={bs.cardTitle}>What's the Budget you have in Mind?</Text>
      </View>

      {loading ? <Shimmer /> : (
        <>
          {/* Budget grid — h-[80px] two-line buttons */}
          <View style={[bs.optGrid, { marginLeft: 8 }]}>
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

          {/* Pax section */}
          <View style={[bs.subSection, { marginLeft: 8 }]}>
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
                  onPress={() => {}} // Pax is auto-selected, display-only (identical to web)
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

// ── Steps 7/9/10/12/13/14/15/16: Menu Selection ───────────────────────────────
const MENU_ENDPOINTS: Record<string, string> = {
  courses:     '/api/catering/menu-items/',
  coffeeBreak: '/api/catering/coffee-break-rotations/',
  platters:    '/api/catering/platter-items/',
  liveStation: '/api/catering/live-station-items/',
  american:    '/api/catering/american-menus/',
  canape:      '/api/catering/canape-items/',
  ramadan:     '/api/catering/ramadan-menus/',
  iftarBoxes:  '/api/catering/iftar-box-menus/',
};
const MENU_STEP_NUMS: Record<string, number> = {
  courses: 6, coffeeBreak: 5, platters: 5, liveStation: 5,
  american: 6, canape: 5, ramadan: 6, iftarBoxes: 6,
};
const MENU_TITLES: Record<string, string> = {
  courses:     'Select Menu Items',
  coffeeBreak: 'Coffee Break Menu',
  platters:    'Platter Menu',
  liveStation: 'Live Station Menu',
  american:    'American Menu Selection',
  canape:      'Canape Menu',
  ramadan:     'Ramadan Menu Selection',
  iftarBoxes:  'Iftar Boxes Menu Selection',
};

const StepMenu = ({ st, update, onNext, onBack, menuType }: StepProps & { menuType: string }) => {
  const [groups, setGroups] = useState<{ id: number; title: string; items: any[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const hdrs  = token ? { Authorization: `Token ${token}` } : {};
        const params: any = {};
        if (menuType === 'courses') {
          if (st.selectedCuisines?.length) params.cuisine_ids   = st.selectedCuisines.map(c => c.id).join(',');
          if (st.selectedBudget?.id)       params.budget_id     = st.selectedBudget.id;
          if (st.selectedEvent?.id)        params.event_type_id = st.selectedEvent.id;
        }
        const res  = await axios.get(`${BASE_URL}${MENU_ENDPOINTS[menuType]}`, { headers: hdrs, params });
        const raw  = res.data;
        let g: typeof groups = [];

        if (menuType === 'coffeeBreak') {
          g = (Array.isArray(raw) ? raw : []).map((rot: any, i: number) => ({
            id: rot.id || i, title: rot.name || `Rotation ${i + 1}`, items: rot.items || [],
          }));
        } else if (['american', 'ramadan', 'iftarBoxes'].includes(menuType)) {
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
      } catch { } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [menuType]);

  const toggle = (item: any) => {
    const exists = st.selectedMenuItems.some(s => s.id === String(item.id));
    update({
      selectedMenuItems: exists
        ? st.selectedMenuItems.filter(s => s.id !== String(item.id))
        : [...st.selectedMenuItems, {
            id: String(item.id), name: item.name,
            course: item.course || item.category || 'Items',
            description: item.description,
            price: item.price ? Number(item.price) : undefined,
            image_url: item.image_url,
          }],
    });
  };

  return (
    <View style={bs.card}>
      <View style={bs.cardHeader}>
        <StepCircle n={MENU_STEP_NUMS[menuType] || 5} />
        <Text style={bs.cardTitle}>{MENU_TITLES[menuType]}</Text>
      </View>

      {loading ? <Shimmer /> : (
        <View style={{ marginLeft: 8, marginTop: 8 }}>
          {groups.map(group => (
            <View key={group.id} style={{ marginBottom: 20 }}>
              <Text style={bs.subHeader}>{group.title}</Text>
              {group.items.map((item: any) => {
                const sel = st.selectedMenuItems.some(s => s.id === String(item.id));
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[bs.menuItem, sel && bs.menuItemActive]}
                    onPress={() => toggle(item)}>
                    {item.image_url && (
                      <Image source={{ uri: item.image_url }} style={bs.menuItemImg} contentFit="cover" />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[bs.menuItemName, sel && { color: Colors.primary }]}>{item.name}</Text>
                      {item.description ? (
                        <Text style={bs.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                      ) : null}
                      {item.price ? (
                        <Text style={bs.menuItemPrice}>AED {parseFloat(item.price).toFixed(2)}</Text>
                      ) : null}
                    </View>
                    {sel && <View style={bs.checkCircle}><Text style={bs.checkMark}>✓</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}

      <NavBtns onBack={onBack} onContinue={onNext} />
    </View>
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
      const orderData: any = {
        event_type:    st.selectedEvent?.name || 'Unknown',
        guest_count:   st.guestCount,
        event_date:    new Date().toISOString().split('T')[0],
        event_time:    '12:00:00',
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
          {/* Guest row */}
          <View style={bs.priceRow}>
            <Text style={bs.priceLbl}>Guest x{st.guestCount}</Text>
            <Text style={bs.priceVal}>AED{baseTotal.toFixed(2)}</Text>
          </View>
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
  const update = useCallback((p: Partial<WizardState>) => setSt(prev => ({ ...prev, ...p })), []);

  // Persist wizard
  useEffect(() => { storage.setJSON('guestCateringOrder', { ...st, step }); }, [step, st]);

  // Restore on mount
  useEffect(() => {
    storage.getJSON<any>('guestCateringOrder').then(saved => {
      if (!saved) return;
      if (saved.step) setStep(saved.step);
      setSt(prev => ({ ...prev, ...saved }));
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
      setStep(p);
    }
  };

  const stepProps: StepProps = { st, update, onNext: goNext, onBack: goBack };

  return (
    <View style={[scrn.screen, { paddingTop: insets.top }]}>
      <Header />

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

        {step === 1  && <Step1EventType  {...stepProps} />}
        {step === 2  && <Step2Location   {...stepProps} />}
        {step === 3  && <Step3Provider   {...stepProps} />}
        {step === 4  && <Step4Cuisine    {...stepProps} />}
        {step === 5  && <Step5Budget     {...stepProps} />}
        {[7,9,10,12,13,14,15,16].includes(step) && (
          <StepMenu {...stepProps} menuType={menuTypeForStep(step, st)} />
        )}
        {step === 8  && <Step8Summary    {...stepProps} />}
      </ScrollView>

      <MobileFooterNav />
    </View>
  );
}

// ── Shared base styles ────────────────────────────────────────────────────────
const bs = StyleSheet.create({
  // Card container — bg-neutral-white border border-[#EDEEF2] rounded-2xl p-4/p-6
  card:         { backgroundColor: Colors.neutralWhite, borderRadius: 16, borderWidth: 1, borderColor: Colors.neutralGrayLightest, padding: 16, marginBottom: 16 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 24 },
  cardTitle:    { fontSize: 18, fontWeight: '700', color: Colors.neutralBlack, flex: 1, lineHeight: 26 },
  // Step circle — bg-primary w-8 h-8 rounded-full
  stepCircle:   { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepCircleText:{ color: Colors.neutralWhite, fontWeight: '700', fontSize: 13 },
  // Sub-sections
  subSection:   { marginTop: 24 },
  subHeader:    { fontSize: 16, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 16 },
  noteText:     { fontSize: 14, fontWeight: '400', color: Colors.neutralGrayDark, marginBottom: 8 },
  // Option buttons — h-[60px] rounded-[16px] border-[#C7C8D2]
  optBtn:       { height: 60, borderRadius: 16, borderWidth: 1, borderColor: Colors.neutralGrayLight, backgroundColor: Colors.neutralWhite, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  optBtnActive: { backgroundColor: '#EAF5FF', borderColor: Colors.primary },
  optBtnDisabled:{ backgroundColor: '#F5F5F5', opacity: 0.7 },
  optBtnText:   { fontSize: 16, fontWeight: '400', color: Colors.neutralBlack },
  optBtnSubText:{ fontSize: 14, fontWeight: '400', color: Colors.neutralGrayDark, marginTop: 4 },
  optBtnTextActive:  { color: Colors.neutralBlack },
  optBtnTextDisabled:{ color: '#A0A0A0' },
  // Option grid — grid-cols-2 equivalent
  optGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  // Event grid (2 columns, card-style)
  eventGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginLeft: 8 },
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
  contBtnDisabled:{ opacity: 0.5 },
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
