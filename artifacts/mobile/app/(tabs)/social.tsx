import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { useApp } from "@/context/AppContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}/`;

type PlatformId = "instagram" | "facebook" | "x";

interface PlatformConfig {
  id: PlatformId;
  name: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: "instagram",
    name: "Instagram",
    color: "#E1306C",
    icon: "instagram",
    description: "Auto-reply to Instagram DMs",
  },
  {
    id: "facebook",
    name: "Facebook",
    color: "#1877F2",
    icon: "facebook",
    description: "Auto-reply to Facebook messages",
  },
  {
    id: "x",
    name: "X (Twitter)",
    color: "#1DA1F2",
    icon: "twitter",
    description: "Auto-reply to X direct messages",
  },
];

interface SimulatedMessage {
  id: string;
  platform: PlatformId;
  sender: string;
  text: string;
  reply?: string;
  loading?: boolean;
  timestamp: number;
}

const DEMO_MESSAGES: SimulatedMessage[] = [
  {
    id: "1",
    platform: "instagram",
    sender: "Priya Sharma",
    text: "Hey! Are you free this weekend? Let's catch up!",
    timestamp: Date.now() - 3600000,
  },
  {
    id: "2",
    platform: "facebook",
    sender: "Rahul Verma",
    text: "Hi, I wanted to ask about your project. When can we discuss?",
    timestamp: Date.now() - 7200000,
  },
  {
    id: "3",
    platform: "x",
    sender: "Alex Johnson",
    text: "Loved your last post! Can you share more details?",
    timestamp: Date.now() - 1800000,
  },
];

export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();

  const [connected, setConnected] = useState<Record<PlatformId, boolean>>({
    instagram: false,
    facebook: false,
    x: false,
  });
  const [autoReply, setAutoReply] = useState<Record<PlatformId, boolean>>({
    instagram: true,
    facebook: true,
    x: true,
  });
  const [messages, setMessages] = useState<SimulatedMessage[]>(DEMO_MESSAGES);
  const [testInput, setTestInput] = useState("");
  const [testPlatform, setTestPlatform] = useState<PlatformId>("instagram");
  const [testLoading, setTestLoading] = useState(false);
  const [testReply, setTestReply] = useState("");
  const [activeSection, setActiveSection] = useState<"connections" | "inbox" | "test">("connections");
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : 84;

  function connectPlatform(pid: PlatformId) {
    const platform = PLATFORMS.find(p => p.id === pid)!;

    if (connected[pid]) {
      Alert.alert(
        `Disconnect ${platform.name}?`,
        "The AI will no longer auto-reply on this platform.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: () => {
              setConnected(prev => ({ ...prev, [pid]: false }));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      `Connect ${platform.name}`,
      `To connect your ${platform.name} account, you would:\n\n1. Go to ${platform.name} Developer Portal\n2. Create a Developer App\n3. Request Messaging API access\n4. Authorize this app via OAuth\n\nFor this demo, we'll simulate the connection.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Connect (Demo)",
          onPress: () => {
            setConnected(prev => ({ ...prev, [pid]: true }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
        },
      ]
    );
  }

  async function generateAutoReply(msg: SimulatedMessage) {
    const platform = PLATFORMS.find(p => p.id === msg.platform)!;
    setMessages(prev =>
      prev.map(m => m.id === msg.id ? { ...m, loading: true } : m)
    );
    Haptics.selectionAsync().catch(() => {});

    try {
      const systemPrompt = `You are the AI assistant for ${profile.name}. ${
        profile.language === "hi"
          ? "Reply in Hindi or Hinglish, naturally."
          : "Reply in English naturally."
      } The tone is ${profile.toneMode}. Generate a short, human-like reply on ${profile.name}'s behalf.`;

      const response = await fetch(`${BASE_URL}api/auto-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg.text,
          platform: platform.name,
          systemPrompt,
        }),
      });

      const data = await response.json();
      setMessages(prev =>
        prev.map(m => m.id === msg.id ? { ...m, reply: data.reply, loading: false } : m)
      );
    } catch {
      setMessages(prev =>
        prev.map(m => m.id === msg.id ? { ...m, loading: false } : m)
      );
    }
  }

  async function testAutoReply() {
    if (!testInput.trim() || testLoading) return;
    setTestLoading(true);
    setTestReply("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      const platform = PLATFORMS.find(p => p.id === testPlatform)!;
      const systemPrompt = `You are the AI assistant for ${profile.name}. ${
        profile.language === "hi"
          ? "Reply in Hindi or Hinglish, naturally."
          : "Reply in English naturally."
      } The tone is ${profile.toneMode}.`;

      const response = await fetch(`${BASE_URL}api/auto-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: testInput,
          platform: platform.name,
          systemPrompt,
        }),
      });

      const data = await response.json();
      setTestReply(data.reply || "");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setTestReply("Error generating reply. Try again.");
    } finally {
      setTestLoading(false);
    }
  }

  function formatTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 60) return `${mins}m ago`;
    return `${hours}h ago`;
  }

  const connectedCount = Object.values(connected).filter(Boolean).length;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPad }]}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Social Media</Text>
          <Text style={styles.subtitle}>
            {connectedCount === 0
              ? "Connect accounts to enable auto-reply"
              : `${connectedCount} account${connectedCount > 1 ? "s" : ""} connected`}
          </Text>
        </View>
        {connectedCount > 0 && (
          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Active</Text>
          </View>
        )}
      </View>

      <View style={styles.segmentedControl}>
        {(["connections", "inbox", "test"] as const).map(tab => (
          <Pressable
            key={tab}
            style={[styles.segment, activeSection === tab && styles.segmentActive]}
            onPress={() => {
              setActiveSection(tab);
              Haptics.selectionAsync().catch(() => {});
            }}
          >
            <Text style={[styles.segmentText, activeSection === tab && styles.segmentTextActive]}>
              {tab === "connections" ? "Accounts" : tab === "inbox" ? "Inbox" : "Test"}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeSection === "connections" && (
        <View style={styles.section}>
          {PLATFORMS.map(platform => (
            <View key={platform.id} style={styles.platformCard}>
              <View style={styles.platformHeader}>
                <View style={[styles.platformIcon, { backgroundColor: `${platform.color}20` }]}>
                  <Feather name={platform.icon} size={22} color={platform.color} />
                </View>
                <View style={styles.platformInfo}>
                  <Text style={styles.platformName}>{platform.name}</Text>
                  <Text style={styles.platformDesc}>{platform.description}</Text>
                </View>
                <Pressable
                  style={[
                    styles.connectBtn,
                    connected[platform.id] ? styles.connectedBtn : styles.disconnectedBtn,
                  ]}
                  onPress={() => connectPlatform(platform.id)}
                >
                  <Text
                    style={[
                      styles.connectBtnText,
                      { color: connected[platform.id] ? Colors.success : platform.color },
                    ]}
                  >
                    {connected[platform.id] ? "Connected" : "Connect"}
                  </Text>
                </Pressable>
              </View>

              {connected[platform.id] && (
                <View style={styles.platformSettings}>
                  <View style={styles.settingRow}>
                    <View>
                      <Text style={styles.settingLabel}>Auto-Reply</Text>
                      <Text style={styles.settingHint}>AI replies on your behalf</Text>
                    </View>
                    <Switch
                      value={autoReply[platform.id]}
                      onValueChange={val => {
                        setAutoReply(prev => ({ ...prev, [platform.id]: val }));
                        Haptics.selectionAsync().catch(() => {});
                      }}
                      trackColor={{ false: Colors.border, true: platform.color }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
              )}
            </View>
          ))}

          <View style={styles.infoCard}>
            <Feather name="info" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              Real integration requires developer API access from each platform. Connect in demo mode to preview how auto-reply works.
            </Text>
          </View>
        </View>
      )}

      {activeSection === "inbox" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SIMULATED INBOX</Text>
          {messages.map(msg => {
            const platform = PLATFORMS.find(p => p.id === msg.platform)!;
            return (
              <View key={msg.id} style={styles.messageCard}>
                <View style={styles.messageHeader}>
                  <View style={[styles.platformDot, { backgroundColor: platform.color }]} />
                  <Text style={styles.platformTag}>{platform.name}</Text>
                  <Text style={styles.messageSender}>{msg.sender}</Text>
                  <Text style={styles.messageTime}>{formatTime(msg.timestamp)}</Text>
                </View>
                <Text style={styles.messageText}>{msg.text}</Text>

                {msg.reply ? (
                  <View style={styles.replyContainer}>
                    <View style={styles.replyHeader}>
                      <Feather name="corner-up-right" size={12} color={Colors.accent} />
                      <Text style={styles.replyLabel}>AI Reply (on your behalf)</Text>
                    </View>
                    <Text style={styles.replyText}>{msg.reply}</Text>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.generateBtn, msg.loading && styles.generateBtnLoading]}
                    onPress={() => !msg.loading && generateAutoReply(msg)}
                  >
                    <Feather name="zap" size={13} color={msg.loading ? Colors.textSecondary : Colors.accent} />
                    <Text style={[styles.generateBtnText, msg.loading && { color: Colors.textSecondary }]}>
                      {msg.loading ? "Generating..." : "Generate AI Reply"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      {activeSection === "test" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TEST AUTO-REPLY</Text>
          <Text style={styles.testDescription}>
            Simulate what the AI would reply when someone messages you on social media.
          </Text>

          <View style={styles.platformPicker}>
            {PLATFORMS.map(p => (
              <Pressable
                key={p.id}
                style={[
                  styles.platformChip,
                  testPlatform === p.id && { borderColor: p.color, backgroundColor: `${p.color}15` },
                ]}
                onPress={() => {
                  setTestPlatform(p.id);
                  Haptics.selectionAsync().catch(() => {});
                }}
              >
                <Feather name={p.icon} size={14} color={testPlatform === p.id ? p.color : Colors.textSecondary} />
                <Text style={[styles.platformChipText, testPlatform === p.id && { color: p.color }]}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.testInputContainer}>
            <TextInput
              style={styles.testInput}
              value={testInput}
              onChangeText={setTestInput}
              placeholder="Type a message someone sent you..."
              placeholderTextColor={Colors.textSecondary}
              multiline
            />
            <Pressable
              style={[styles.testSendBtn, testLoading && { opacity: 0.5 }]}
              onPress={testAutoReply}
              disabled={testLoading || !testInput.trim()}
            >
              <Feather name="send" size={16} color="#fff" />
            </Pressable>
          </View>

          {testReply !== "" && (
            <View style={styles.testReplyCard}>
              <View style={styles.testReplyHeader}>
                <View style={styles.aiAvatar}>
                  <Feather name="zap" size={12} color="#fff" />
                </View>
                <Text style={styles.testReplyLabel}>AI Reply (as {profile.name})</Text>
              </View>
              <Text style={styles.testReplyText}>{testReply}</Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <Feather name="shield" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              The AI uses your name, language preference ({profile.language.toUpperCase()}), and tone ({profile.toneMode}) to craft replies that sound like you.
            </Text>
          </View>
        </View>
      )}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: `${Colors.success}15`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${Colors.success}30`,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  activeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.success,
  },
  segmentedControl: {
    flexDirection: "row",
    margin: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: Colors.accent,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    marginTop: 4,
  },
  platformCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  platformHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  platformIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  platformInfo: {
    flex: 1,
    gap: 2,
  },
  platformName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  platformDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  connectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  connectedBtn: {
    borderColor: `${Colors.success}50`,
    backgroundColor: `${Colors.success}10`,
  },
  disconnectedBtn: {
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  connectBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  platformSettings: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  settingHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "flex-start",
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  messageCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  platformDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  platformTag: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  messageSender: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    flex: 1,
  },
  messageTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  messageText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 22,
  },
  replyContainer: {
    backgroundColor: `${Colors.accent}10`,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: `${Colors.accent}25`,
    gap: 6,
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  replyLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  replyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 20,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: `${Colors.accent}40`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  generateBtnLoading: {
    borderColor: Colors.border,
  },
  generateBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  testDescription: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  platformPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  platformChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  platformChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  testInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
  },
  testInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    minHeight: 60,
    maxHeight: 120,
  },
  testSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  testReplyCard: {
    backgroundColor: `${Colors.accent}10`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${Colors.accent}30`,
    padding: 14,
    gap: 10,
  },
  testReplyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  testReplyLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  testReplyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 22,
  },
});
