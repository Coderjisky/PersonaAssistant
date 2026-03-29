import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { type Language, type ToneMode, useApp } from "@/context/AppContext";

type PickerOption<T> = {
  value: T;
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

const LANGUAGE_OPTIONS: PickerOption<Language>[] = [
  { value: "en", label: "English", icon: "globe" },
  { value: "hi", label: "हिंदी", icon: "globe" },
];

const TONE_OPTIONS: PickerOption<ToneMode>[] = [
  { value: "friendly", label: "Friendly", icon: "smile" },
  { value: "professional", label: "Professional", icon: "briefcase" },
  { value: "romantic", label: "Romantic", icon: "heart" },
  { value: "casual", label: "Casual", icon: "coffee" },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useApp();
  const [nameInput, setNameInput] = useState(profile.name);
  const [saved, setSaved] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 84;

  async function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    await updateProfile({ name: trimmed });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPad }]}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>YOUR NAME</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Enter your name"
            placeholderTextColor={Colors.textSecondary}
            returnKeyType="done"
            onSubmitEditing={saveName}
          />
          <Pressable
            style={[styles.saveBtn, saved && styles.savedBtn]}
            onPress={saveName}
          >
            <Feather
              name={saved ? "check" : "save"}
              size={16}
              color={saved ? Colors.success : Colors.accent}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>LANGUAGE</Text>
        <View style={styles.optionGrid}>
          {LANGUAGE_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              style={[
                styles.optionCard,
                profile.language === opt.value && styles.optionCardActive,
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                updateProfile({ language: opt.value });
              }}
            >
              <Feather
                name={opt.icon}
                size={18}
                color={profile.language === opt.value ? Colors.accent : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.optionLabel,
                  profile.language === opt.value && styles.optionLabelActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CONVERSATION TONE</Text>
        <View style={styles.optionGrid}>
          {TONE_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              style={[
                styles.optionCard,
                profile.toneMode === opt.value && styles.optionCardActive,
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                updateProfile({ toneMode: opt.value });
              }}
            >
              <Feather
                name={opt.icon}
                size={18}
                color={profile.toneMode === opt.value ? Colors.accent : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.optionLabel,
                  profile.toneMode === opt.value && styles.optionLabelActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>AUTO-REPLY</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Enable Auto-Reply</Text>
              <Text style={styles.toggleSubtitle}>
                AI replies on your behalf when you are busy
              </Text>
            </View>
            <Switch
              value={profile.autoReplyEnabled}
              onValueChange={val => {
                Haptics.selectionAsync().catch(() => {});
                updateProfile({ autoReplyEnabled: val });
              }}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor="#fff"
            />
          </View>
          {profile.autoReplyEnabled && (
            <View style={styles.autoReplyMsgContainer}>
              <Text style={styles.autoReplyLabel}>Auto-reply message:</Text>
              <TextInput
                style={styles.autoReplyInput}
                value={profile.autoReplyMessage}
                onChangeText={text => updateProfile({ autoReplyMessage: text })}
                multiline
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <View style={styles.aboutOrb}>
              <Feather name="zap" size={20} color="#fff" />
            </View>
            <View style={styles.aboutInfo}>
              <Text style={styles.aboutTitle}>AI Assistant</Text>
              <Text style={styles.aboutSub}>
                Powered by advanced AI — your personal communication companion
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    gap: 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  nameRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  nameInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  savedBtn: {
    borderColor: Colors.success,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionCardActive: {
    borderColor: Colors.accent,
    backgroundColor: `${Colors.accent}18`,
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  optionLabelActive: {
    color: Colors.accent,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 12,
  },
  toggleInfo: {
    flex: 1,
    gap: 3,
  },
  toggleTitle: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  toggleSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  autoReplyMsgContainer: {
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  autoReplyLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  autoReplyInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  aboutOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  aboutInfo: {
    flex: 1,
    gap: 3,
  },
  aboutTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  aboutSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
});
