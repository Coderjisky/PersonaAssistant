import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatInput } from "@/components/ChatInput";
import { EmptyChat } from "@/components/EmptyChat";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import Colors from "@/constants/colors";
import { type Message, useApp } from "@/context/AppContext";
import { buildSystemPrompt, generateMsgId, streamChat } from "@/lib/ai";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}/`;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, currentConversation, setCurrentConversation, saveConversation } = useApp();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const conversationRef = useRef(currentConversation);
  const initializedRef = useRef(false);

  useEffect(() => {
    conversationRef.current = currentConversation;
  }, [currentConversation]);

  useEffect(() => {
    if (currentConversation?.messages && !initializedRef.current) {
      setMessages(currentConversation.messages);
      initializedRef.current = true;
    }
  }, [currentConversation?.messages]);

  const headerTop = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleSend(text: string) {
    if (isStreaming || !currentConversation) return;

    const currentMessages = [...messages];

    const userMsg: Message = {
      id: generateMsgId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...currentMessages, userMsg];
    setMessages(updatedMessages);
    setIsStreaming(true);
    setShowTyping(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const systemPrompt = buildSystemPrompt(profile.name, profile.language, profile.toneMode);

    let fullContent = "";
    let assistantAdded = false;
    let assistantId = generateMsgId();

    try {
      const allMessages: Message[] = [
        ...updatedMessages,
      ];

      await streamChat(
        allMessages,
        systemPrompt,
        BASE_URL,
        (chunk) => {
          fullContent += chunk;

          if (!assistantAdded) {
            setShowTyping(false);
            setMessages(prev => [
              ...prev,
              {
                id: assistantId,
                role: "assistant",
                content: fullContent,
                timestamp: Date.now(),
              },
            ]);
            assistantAdded = true;
          } else {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: fullContent,
              };
              return updated;
            });
          }
        }
      );
    } catch (error) {
      setShowTyping(false);
      const errText =
        profile.language === "hi"
          ? "Maafi kijiye, koi gadbad ho gayi. Dobara koshish karein."
          : "Sorry, something went wrong. Please try again.";
      setMessages(prev => [
        ...prev,
        {
          id: generateMsgId(),
          role: "assistant",
          content: errText,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setShowTyping(false);

      const conv = conversationRef.current;
      if (conv) {
        setMessages(prev => {
          const newTitle =
            prev.length === 2
              ? text.slice(0, 40) + (text.length > 40 ? "..." : "")
              : conv.title;

          const updatedConv = {
            ...conv,
            title: newTitle,
            messages: prev,
            updatedAt: Date.now(),
          };
          setCurrentConversation(updatedConv);
          saveConversation(updatedConv).catch(() => {});
          return prev;
        });
      }
    }
  }

  function handleBack() {
    router.back();
  }

  const reversedMessages = [...messages].reverse();

  const placeholder =
    profile.language === "hi"
      ? "Kuch poochhen..."
      : "Message...";

  return (
    <View style={[styles.container]}>
      <View style={[styles.header, { paddingTop: headerTop + 8 }]}>
        <Pressable style={styles.backBtn} onPress={handleBack}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerOrb}>
            <Feather name="zap" size={14} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <Text style={styles.headerStatus}>
              {isStreaming ? "typing..." : "online"}
            </Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View style={styles.flex}>
            <EmptyChat
              language={profile.language}
              tone={profile.toneMode}
              name={profile.name}
              onSuggestionPress={handleSend}
            />
            <View style={{ paddingBottom: bottomPad }}>
              <ChatInput
                onSend={handleSend}
                disabled={isStreaming}
                placeholder={placeholder}
              />
            </View>
          </View>
        ) : (
          <>
            <FlatList
              data={reversedMessages}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
              inverted={messages.length > 0}
              ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
            <View style={{ paddingBottom: bottomPad }}>
              <ChatInput
                onSend={handleSend}
                disabled={isStreaming}
                placeholder={placeholder}
              />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerOrb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  headerStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.success,
  },
  listContent: {
    paddingVertical: 12,
  },
});
