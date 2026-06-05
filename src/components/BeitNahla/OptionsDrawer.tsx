/**
 * OptionsDrawer — faithful translation of web
 * components/BeitNahla/OptionsDrawer.tsx
 *
 * Right slide-in drawer (framer-motion → moti). Two levels:
 *   Level 1 — category list: each row shows "N of M selected" or a red
 *             "Pick at least one" warning when a category has zero selections.
 *   Level 2 — item list for the active category: every item has a Switch.
 *
 * Rules preserved exactly:
 *   - Defaults: every item in every category is pre-selected.
 *   - Each non-empty category must keep ≥1 selection to confirm.
 *   - Footer Confirm button reflects how many categories still need a pick.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { X, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react-native';
import { Colors } from '@/utils/colors';
import { MealBoxType } from './BeitNahlaCard';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export interface OptionItem {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  display_order: number;
}

export interface OptionCategory {
  id: number;
  name: string;
  description: string;
  display_order: number;
  items: OptionItem[];
}

interface OptionsDrawerProps {
  open: boolean;
  mealBox: MealBoxType | null;
  categories: OptionCategory[];
  initialSelections?: Record<number, number[]>;
  onClose: () => void;
  onConfirm: (selections: Record<number, number[]>) => void;
}

export default function OptionsDrawer({
  open,
  mealBox,
  categories,
  initialSelections,
  onClose,
  onConfirm,
}: OptionsDrawerProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [selections, setSelections] = useState<Record<number, number[]>>({});

  // Default: every item in every category is selected. Users can toggle off
  // individuals, but each category must keep at least one.
  const buildDefaults = (): Record<number, number[]> => {
    const map: Record<number, number[]> = {};
    categories.forEach((c) => {
      map[c.id] = c.items.map((i) => i.id);
    });
    return map;
  };

  useEffect(() => {
    if (open) {
      setSelections(
        initialSelections && Object.keys(initialSelections).length > 0
          ? initialSelections
          : buildDefaults(),
      );
      setActiveCategoryId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mealBox?.id, categories]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) || null,
    [activeCategoryId, categories],
  );

  const totalSelected = useMemo(
    () => Object.values(selections).reduce((s, arr) => s + arr.length, 0),
    [selections],
  );

  const categoriesWithSelections = useMemo(
    () => categories.filter((c) => (selections[c.id] || []).length > 0).length,
    [categories, selections],
  );

  // Categories that have items but zero selections — user must pick ≥1 per.
  const emptyCategories = useMemo(
    () =>
      categories
        .filter((c) => c.items.length > 0 && (selections[c.id] || []).length === 0)
        .map((c) => c.name),
    [categories, selections],
  );

  const toggleItem = (categoryId: number, itemId: number) => {
    setSelections((prev) => {
      const current = prev[categoryId] || [];
      const next = current.includes(itemId)
        ? current.filter((i) => i !== itemId)
        : [...current, itemId];
      return { ...prev, [categoryId]: next };
    });
  };

  const canConfirm = emptyCategories.length === 0 && totalSelected > 0;

  if (!mealBox) return null;

  const confirmLabel =
    emptyCategories.length > 0
      ? `Need ${emptyCategories.length} more — ${emptyCategories.join(', ')}`
      : `Confirm (${totalSelected} item${totalSelected === 1 ? '' : 's'})`;

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <MotiView
          from={{ translateX: SCREEN_W }}
          animate={{ translateX: 0 }}
          transition={{ type: 'spring', stiffness: 250, damping: 30 }}
          style={styles.panel}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {activeCategory && (
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => setActiveCategoryId(null)}>
                  <ChevronLeft size={20} color={Colors.primary} />
                </TouchableOpacity>
              )}
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {activeCategory ? activeCategory.name : mealBox.name}
                </Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  {activeCategory
                    ? 'Pick at least one'
                    : `${categoriesWithSelections}/${categories.length} categories chosen`}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={Colors.neutralGray} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}>
            {activeCategory === null ? (
              // ── Level 1: category list ──────────────────────────────
              categories.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <Text style={styles.emptyText}>
                    No option categories available.
                  </Text>
                </View>
              ) : (
                categories.map((cat) => {
                  const count = (selections[cat.id] || []).length;
                  const isEmpty = cat.items.length > 0 && count === 0;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      activeOpacity={0.85}
                      onPress={() => setActiveCategoryId(cat.id)}
                      style={[styles.catRow, isEmpty && styles.catRowEmpty]}>
                      <View style={styles.catRowText}>
                        <Text style={styles.catName}>{cat.name}</Text>
                        {!!cat.description && (
                          <Text style={styles.catDesc} numberOfLines={1}>
                            {cat.description}
                          </Text>
                        )}
                        {isEmpty ? (
                          <View style={styles.catWarnRow}>
                            <AlertCircle size={12} color={Colors.secondary} />
                            <Text style={styles.catWarnText}>Pick at least one</Text>
                          </View>
                        ) : (
                          <Text style={styles.catCount}>
                            {count} of {cat.items.length} selected
                          </Text>
                        )}
                      </View>
                      <ChevronRight size={20} color="#83859C" />
                    </TouchableOpacity>
                  );
                })
              )
            ) : (
              // ── Level 2: item toggles ──────────────────────────────
              <>
                {(selections[activeCategory.id] || []).length === 0 && (
                  <View style={styles.inlineWarn}>
                    <AlertCircle size={16} color={Colors.secondary} />
                    <Text style={styles.inlineWarnText}>
                      Pick at least one {activeCategory.name.toLowerCase()} item.
                    </Text>
                  </View>
                )}
                {activeCategory.items.length === 0 ? (
                  <View style={styles.emptyBlock}>
                    <Text style={styles.emptyText}>No items in this category.</Text>
                  </View>
                ) : (
                  activeCategory.items.map((item) => {
                    const isSelected = (
                      selections[activeCategory.id] || []
                    ).includes(item.id);
                    return (
                      <View
                        key={item.id}
                        style={[styles.itemRow, isSelected && styles.itemRowSelected]}>
                        <View style={styles.itemLeft}>
                          {!!item.image_url && (
                            <Image
                              source={{ uri: item.image_url }}
                              style={styles.itemImage}
                              contentFit="cover"
                            />
                          )}
                          <View style={styles.itemTextWrap}>
                            <Text style={styles.itemName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {!!item.description && (
                              <Text style={styles.itemDesc} numberOfLines={1}>
                                {item.description}
                              </Text>
                            )}
                          </View>
                        </View>
                        <Switch
                          value={isSelected}
                          onValueChange={() => toggleItem(activeCategory.id, item.id)}
                          trackColor={{ false: Colors.neutralGrayLight, true: Colors.primary }}
                          thumbColor={Colors.neutralWhite}
                          ios_backgroundColor={Colors.neutralGrayLight}
                        />
                      </View>
                    );
                  })
                )}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              disabled={!canConfirm}
              onPress={() => canConfirm && onConfirm(selections)}>
              <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  panel: {
    width: Math.min(SCREEN_W, 500), // max-w-[500px]
    height: SCREEN_H,
    backgroundColor: Colors.neutralWhite,
    paddingHorizontal: 16,
    paddingTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  backBtn: {
    padding: 4,
    borderRadius: 999,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutralBlack,
    lineHeight: 24,
  },
  headerSub: {
    fontSize: 12,
    color: '#83859C',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 999,
  },
  // Body
  body: {
    flex: 1,
  },
  bodyContent: {
    gap: 12,
    paddingBottom: 12,
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#83859C',
    fontSize: 14,
  },
  // Level 1 — category rows
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
  },
  catRowEmpty: {
    borderColor: '#FCA5A5',
    backgroundColor: 'rgba(254,242,242,0.4)',
  },
  catRowText: {
    flex: 1,
    gap: 2,
  },
  catName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  catDesc: {
    fontSize: 11,
    color: '#83859C',
  },
  catWarnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  catWarnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.secondary,
  },
  catCount: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 4,
  },
  // Level 2 — item rows
  inlineWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  inlineWarnText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.neutralGrayLightest,
  },
  itemRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(5,74,134,0.05)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  itemDesc: {
    fontSize: 11,
    color: '#83859C',
    marginTop: 2,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cancelBtn: {
    width: '32%',
    borderWidth: 2,
    borderColor: '#EBEBEB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: Colors.neutralGrayDark,
    fontWeight: '700',
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: Colors.neutralGrayLight,
  },
  confirmBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
});
