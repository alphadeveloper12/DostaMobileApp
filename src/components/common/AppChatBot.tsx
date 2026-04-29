/**
 * AppChatBot — direct port of web `components/common/ChatBot.tsx`.
 *
 * Renders a bottom-right floating action button on every screen that
 * opens an AI chat panel. Mounted once at the app root (App.tsx) so it
 * stays "sticky" across navigation transitions.
 *
 * Parity points with the web component:
 *   • #054A86 header with Bot badge, title, "Online | Sales & Service"
 *   • Bot/user message bubbles with rounded-tl-none / rounded-tr-none corners
 *   • "Thinking..." loader bubble during in-flight requests
 *   • Send button disabled while empty / loading
 *   • Calls the same `/api/chatbot/chat/` endpoint via `sendChatMessage`
 *
 * Mobile-specific concerns:
 *   • `pointerEvents="box-none"` on the absolute root so taps pass through
 *     to the screens behind when the panel is closed.
 *   • Bottom offset stacks above the MobileFooterNav (h-82 + safe-area).
 *   • KeyboardAvoidingView keeps the input visible when the keyboard opens.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import {
  MessageSquare,
  X,
  Send,
  User as UserIcon,
  Bot,
  Loader2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/utils/colors';
import { sendChatMessage } from '@/services/api';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

// Tiny event bus — equivalent to the web's `window.dispatchEvent(new Event(
// 'open-chatbot'))` pattern. Any screen can call `openAppChatBot()` to
// programmatically pop the panel open.
type Opener = () => void;
const openers = new Set<Opener>();
export const openAppChatBot = () => openers.forEach(fn => fn());

// Layout constants reused below.
const FOOTER_NAV_H  = 82;   // MobileFooterNav height
const FAB_H         = 60;
const FAB_GAP       = 16;   // gap between FAB and panel
const FAB_BOTTOM_PAD = 16;  // gap above the footer nav

const INITIAL_MESSAGE: Message = {
  role: 'bot',
  content: "Hello! I'm Dosta's AI assistant. How can I help you today?",
};

export default function AppChatBot() {
  const insets = useSafeAreaInsets();
  // useWindowDimensions reacts to rotation / split-screen, unlike the
  // module-level Dimensions.get('window') which is frozen at import time.
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll on new messages or when reopening.
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, isOpen]);

  // Allow anywhere in the app to pop the chat open via openAppChatBot().
  useEffect(() => {
    const open: Opener = () => setIsOpen(true);
    openers.add(open);
    return () => { openers.delete(open); };
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setIsLoading(true);

    try {
      const reply = await sendChatMessage(trimmed);
      setMessages(prev => [...prev, { role: 'bot', content: reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          content:
            "Sorry, I'm having trouble connecting right now. Please try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // FAB sits above the MobileFooterNav (82px tall) + safe-area bottom inset.
  // Web equivalent: `max-md:bottom-[100px] max-md:right-4`.
  const bottomOffset = (insets.bottom || 0) + FOOTER_NAV_H + FAB_BOTTOM_PAD;

  // Available vertical space between the top of the FAB and the top safe-area
  // inset. Subtract a small breathing margin so the panel never butts up
  // against the status bar / notch.
  const TOP_BREATHING = 12;
  const reservedBelow = bottomOffset + FAB_H + FAB_GAP;          // FAB + gap to panel
  const reservedAbove = (insets.top || 0) + TOP_BREATHING;
  const availableH    = Math.max(280, SCREEN_H - reservedBelow - reservedAbove);
  // Web base size is 500px tall; clamp to whatever the device can actually fit.
  const panelH = Math.min(520, availableH);
  const panelW = Math.min(400, SCREEN_W - 24);

  const canSend = !!input.trim() && !isLoading;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { bottom: bottomOffset }]}>
      <AnimatePresence>
        {isOpen && (
          <MotiView
            key="chat-panel"
            from={{ opacity: 0, scale: 0.9, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            exit={{ opacity: 0, scale: 0.9, translateY: 20 }}
            transition={{ type: 'timing', duration: 220 }}
            style={[styles.panel, { width: panelW, height: panelH }]}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.flex1}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.botBadge}>
                    <Bot size={20} color={Colors.neutralWhite} />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>Dosta Assistant</Text>
                    <Text style={styles.subtitle}>
                      Online | Sales & Service
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setIsOpen(false)}
                  hitSlop={10}
                  style={styles.closeBtn}>
                  <X size={20} color={Colors.neutralWhite} />
                </TouchableOpacity>
              </View>

              {/* Messages */}
              <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                onContentSizeChange={() =>
                  scrollRef.current?.scrollToEnd({ animated: false })
                }
                keyboardShouldPersistTaps="handled">
                {messages.map((msg, idx) => (
                  <MessageBubble key={idx} msg={msg} />
                ))}

                {isLoading && <ThinkingBubble />}
              </ScrollView>

              {/* Input */}
              <View style={styles.inputRow}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Type your message..."
                  placeholderTextColor={Colors.neutralGray}
                  style={styles.input}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                  editable={!isLoading}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!canSend}
                  activeOpacity={0.85}
                  style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}>
                  <Send size={18} color={Colors.neutralWhite} />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </MotiView>
        )}
      </AnimatePresence>

      {/* Floating toggle */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setIsOpen(v => !v)}
        style={styles.fab}>
        {isOpen ? (
          <X size={28} color={Colors.neutralWhite} />
        ) : (
          <MessageSquare size={28} color={Colors.neutralWhite} />
        )}
      </TouchableOpacity>
    </View>
  );
}

// Pulled out so the map step stays readable.
const MessageBubble = ({ msg }: { msg: Message }) => {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
      {!isUser && (
        <View style={[styles.avatar, styles.avatarBot, styles.avatarLeft]}>
          <Bot size={16} color={Colors.neutralWhite} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot,
        ]}>
        <Text
          style={isUser ? styles.bubbleTextUser : styles.bubbleTextBot}>
          {msg.content}
        </Text>
      </View>
      {isUser && (
        <View style={[styles.avatar, styles.avatarUser, styles.avatarRight]}>
          <UserIcon size={16} color={Colors.primary} />
        </View>
      )}
    </View>
  );
};

const ThinkingBubble = () => (
  <View style={[styles.row, styles.rowBot]}>
    <View style={[styles.avatar, styles.avatarBot, styles.avatarLeft]}>
      <Bot size={16} color={Colors.neutralWhite} />
    </View>
    <View style={[styles.bubble, styles.bubbleBot, styles.thinkingBubble]}>
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: '360deg' }}
        transition={{
          type: 'timing',
          duration: 900,
          loop: true,
          repeatReverse: false,
        }}>
        <Loader2 size={16} color={Colors.primary} />
      </MotiView>
      <Text style={styles.thinkingText}>Thinking...</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  // Floating root container — anchors panel + FAB to the bottom-right.
  root: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    zIndex: 9999,
    elevation: 24,
  },
  flex1: { flex: 1 },

  // Panel (the chat window)
  panel: {
    backgroundColor: Colors.neutralWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLight,
    overflow: 'hidden',
    marginBottom: 16,                                  // gap between panel and FAB
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 18,
  },

  // Header
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { marginLeft: 4 },
  botBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title:    { fontSize: 16, fontWeight: '700', color: Colors.neutralWhite },
  subtitle: { fontSize: 12, color: Colors.neutralWhite, opacity: 0.8 },
  closeBtn: {
    padding: 4,
    borderRadius: 9999,
  },

  // Messages list
  scroll:        { flex: 1, backgroundColor: 'rgba(237,238,242,0.30)' },
  scrollContent: { padding: 16, gap: 14 },

  row:     { flexDirection: 'row', alignItems: 'flex-end', maxWidth: '100%' },
  rowBot:  { justifyContent: 'flex-start' },
  rowUser: { justifyContent: 'flex-end' },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarLeft:  { marginRight: 8 },
  avatarRight: { marginLeft: 8 },
  avatarBot:   { backgroundColor: Colors.primary },
  avatarUser:  { backgroundColor: Colors.primaryLight },

  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  // Bot bubble: white w/ border, top-left corner squared off.
  bubbleBot: {
    backgroundColor: Colors.neutralWhite,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLight,
    borderTopLeftRadius: 4,
  },
  // User bubble: primary-dark fill, top-right corner squared off.
  bubbleUser: {
    backgroundColor: Colors.primaryDark,
    borderTopRightRadius: 4,
  },
  bubbleTextBot:  { fontSize: 14, lineHeight: 20, color: Colors.neutralBlack },
  bubbleTextUser: { fontSize: 14, lineHeight: 20, color: Colors.neutralWhite },

  // Thinking… bubble
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thinkingText: {
    fontSize: 14,
    color: Colors.neutralGray,
    fontStyle: 'italic',
    marginLeft: 8,
  },

  // Input row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.neutralGrayLight,
    backgroundColor: Colors.neutralWhite,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: Colors.neutralBlack,
    marginRight: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },

  // FAB (floating action button)
  fab: {
    width: 60,
    height: 60,
    borderRadius: 9999,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.30,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 12,
  },
});
