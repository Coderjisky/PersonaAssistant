import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { buildSystemPrompt } from "@/lib/ai";
import { useApp } from "@/context/AppContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}/`;

type CallStatus = "idle" | "listening" | "processing" | "speaking" | "error";

interface TranscriptLine {
  id: string;
  speaker: "user" | "ai";
  text: string;
}

let lineCounter = 0;
function genId() {
  lineCounter++;
  return `line-${Date.now()}-${lineCounter}`;
}

export default function VoiceCallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useApp();

  const [status, setStatus] = useState<CallStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim1 = useRef(new Animated.Value(1)).current;
  const ringAnim2 = useRef(new Animated.Value(1)).current;
  const recordingRef = useRef<any>(null);
  const soundRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartRef = useRef<number>(Date.now());
  const isWeb = Platform.OS === "web";

  useEffect(() => {
    startPulseAnimation();
    callStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupRecording();
      cleanupSound();
    };
  }, []);

  function startPulseAnimation() {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    const ring1 = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim1, { toValue: 1.6, duration: 1400, useNativeDriver: true }),
        Animated.timing(ringAnim1, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.delay(200),
      ])
    );
    const ring2 = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(ringAnim2, { toValue: 1.6, duration: 1400, useNativeDriver: true }),
        Animated.timing(ringAnim2, { toValue: 1, duration: 0, useNativeDriver: true }),
      ])
    );
    ring1.start();
    ring2.start();
  }

  async function cleanupRecording() {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
  }

  async function cleanupSound() {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  }

  const handlePressIn = useCallback(async () => {
    if (status === "processing" || status === "speaking" || isWeb) return;
    if (!isWeb) {
      try {
        const { Audio } = await import("expo-av");
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;
        setIsRecording(true);
        setStatus("listening");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } catch (err) {
        setErrorMsg("Microphone access failed. Check permissions.");
        setStatus("error");
      }
    }
  }, [status, isWeb]);

  const handlePressOut = useCallback(async () => {
    if (!isRecording || !recordingRef.current) return;

    setIsRecording(false);
    setStatus("processing");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI");

      const { FileSystem } = await import("expo-file-system");
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const systemPrompt = buildSystemPrompt(profile.name, profile.language, profile.toneMode);

      const response = await fetch(`${BASE_URL}api/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: base64Audio,
          format: "m4a",
          systemPrompt,
        }),
      });

      if (!response.ok) throw new Error("Voice API error");
      const data = await response.json();

      if (data.transcript) {
        setTranscript(prev => [
          ...prev,
          { id: genId(), speaker: "user", text: data.transcript },
        ]);
      }

      if (data.audio) {
        setStatus("speaking");

        const tmpPath = FileSystem.cacheDirectory + `ai-response-${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(tmpPath, data.audio, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { Audio } = await import("expo-av");
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        await cleanupSound();
        const { sound } = await Audio.Sound.createAsync({ uri: tmpPath });
        soundRef.current = sound;

        sound.setOnPlaybackStatusUpdate((playStatus: any) => {
          if (playStatus.didJustFinish) {
            setStatus("idle");
            FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});
          }
        });

        const incomingText =
          profile.language === "hi"
            ? "(AI ne jawab diya - play ho raha hai)"
            : "(AI is speaking...)";

        setTranscript(prev => [
          ...prev,
          { id: genId(), speaker: "ai", text: incomingText },
        ]);

        await sound.playAsync();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        setStatus("idle");
      }
    } catch (err) {
      setErrorMsg("Something went wrong. Try again.");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [isRecording, profile]);

  function handleEndCall() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    router.back();
  }

  function formatDuration(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const statusLabel: Record<CallStatus, string> = {
    idle: profile.language === "hi" ? "Hold karein bolne ke liye" : "Hold to speak",
    listening: profile.language === "hi" ? "Sun raha hoon..." : "Listening...",
    processing: profile.language === "hi" ? "Soch raha hoon..." : "Thinking...",
    speaking: profile.language === "hi" ? "Bol raha hoon..." : "Speaking...",
    error: errorMsg,
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad + 20 }]}>
      <View style={styles.header}>
        <Text style={styles.callLabel}>AI Voice Call</Text>
        <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
      </View>

      <View style={styles.avatarSection}>
        <Animated.View
          style={[
            styles.ring,
            styles.ring2,
            {
              transform: [{ scale: ringAnim2 }],
              opacity: ringAnim2.interpolate({ inputRange: [1, 1.6], outputRange: [0.15, 0] }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            styles.ring1,
            {
              transform: [{ scale: ringAnim1 }],
              opacity: ringAnim1.interpolate({ inputRange: [1, 1.6], outputRange: [0.25, 0] }),
            },
          ]}
        />
        <Animated.View style={[styles.avatarOuter, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatar}>
            <Feather name="zap" size={40} color="#fff" />
          </View>
        </Animated.View>

        <Text style={styles.aiName}>AI Assistant</Text>
        <Text style={styles.statusText}>{statusLabel[status]}</Text>
      </View>

      {transcript.length > 0 && (
        <ScrollView
          style={styles.transcriptContainer}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {transcript.map(line => (
            <View
              key={line.id}
              style={[
                styles.transcriptLine,
                line.speaker === "user" ? styles.userLine : styles.aiLine,
              ]}
            >
              <Text style={styles.speakerLabel}>
                {line.speaker === "user" ? "You" : "AI"}
              </Text>
              <Text style={styles.transcriptText}>{line.text}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.controls}>
        {isWeb ? (
          <View style={styles.webNotice}>
            <Feather name="smartphone" size={20} color={Colors.textSecondary} />
            <Text style={styles.webNoticeText}>
              Voice calling requires the Expo Go app on your phone.{"\n"}Scan the QR code to try it on your device.
            </Text>
          </View>
        ) : (
          <Pressable
            style={[
              styles.recordBtn,
              isRecording && styles.recordBtnActive,
              status === "processing" && styles.recordBtnProcessing,
              status === "speaking" && styles.recordBtnSpeaking,
            ]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={status === "processing" || status === "speaking"}
          >
            <Feather
              name={isRecording ? "mic" : status === "processing" ? "loader" : status === "speaking" ? "volume-2" : "mic"}
              size={32}
              color="#fff"
            />
          </Pressable>
        )}

        <Pressable style={styles.endCallBtn} onPress={handleEndCall}>
          <Feather name="phone-off" size={26} color="#fff" />
        </Pressable>
      </View>

      {!isWeb && (
        <Text style={styles.hint}>
          {profile.language === "hi"
            ? "Mic button ko hold karein bolne ke liye"
            : "Hold the mic button to speak"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A10",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    paddingTop: 8,
    gap: 4,
  },
  callLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  duration: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  avatarSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  ring: {
    position: "absolute",
    borderRadius: 200,
    backgroundColor: Colors.accent,
  },
  ring1: {
    width: 160,
    height: 160,
  },
  ring2: {
    width: 220,
    height: 220,
  },
  avatarOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${Colors.accent}40`,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },
  aiName: {
    fontSize: 24,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginTop: 8,
  },
  statusText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  transcriptContainer: {
    maxHeight: 180,
    width: "100%",
    marginHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    alignSelf: "stretch",
    marginLeft: 20,
    marginRight: 20,
  },
  transcriptContent: {
    padding: 14,
    gap: 10,
  },
  transcriptLine: {
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  userLine: {
    backgroundColor: `${Colors.accent}20`,
    alignSelf: "flex-end",
    maxWidth: "85%",
  },
  aiLine: {
    backgroundColor: "rgba(255,255,255,0.06)",
    alignSelf: "flex-start",
    maxWidth: "85%",
  },
  speakerLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  transcriptText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 20,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 40,
    paddingBottom: 20,
  },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  recordBtnActive: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
    transform: [{ scale: 1.1 }],
  },
  recordBtnProcessing: {
    backgroundColor: Colors.textSecondary,
    shadowOpacity: 0,
  },
  recordBtnSpeaking: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
  },
  endCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  webNotice: {
    alignItems: "center",
    gap: 10,
    padding: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 320,
  },
  webNoticeText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
});
