import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import type { Language, ToneMode } from "@/context/AppContext";

interface Props {
  language: Language;
  tone: ToneMode;
  name: string;
}

const SUGGESTIONS: Record<Language, string[]> = {
  en: [
    "Help me write a message to my friend",
    "Tell me a joke to lighten my mood",
    "How do I stay productive today?",
    "Write a professional email for me",
  ],
  hi: [
    "Mere dost ko message likhne mein madad karo",
    "Koi mazedaar joke sunao",
    "Aaj productive rehne ke tips do",
    "Professional email likhne mein help karo",
  ],
};

const GREETINGS: Record<Language, (name: string) => string> = {
  en: (name) => `Hello, ${name}! How can I assist you today?`,
  hi: (name) => `Namaste, ${name}! Main aaj aapki kaise madad kar sakta hoon?`,
};

interface EmptyChatProps extends Props {
  onSuggestionPress: (text: string) => void;
}

export function EmptyChat({ language, name, onSuggestionPress }: EmptyChatProps) {
  const suggestions = SUGGESTIONS[language];
  const greeting = GREETINGS[language](name);

  return (
    <View style={styles.container}>
      <View style={styles.orbContainer}>
        <View style={styles.orb}>
          <Feather name="zap" size={32} color="#fff" />
        </View>
      </View>
      <Text style={styles.greeting}>{greeting}</Text>
      <View style={styles.suggestionsGrid}>
        {suggestions.map((s, i) => (
          <View
            key={i}
            style={styles.suggestionWrapper}
          >
            <View style={styles.suggestion}>
              <Text
                style={styles.suggestionText}
                onPress={() => onSuggestionPress(s)}
                suppressHighlighting
              >
                {s}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 20,
  },
  orbContainer: {
    marginBottom: 4,
  },
  orb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  greeting: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    textAlign: "center",
    lineHeight: 26,
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    width: "100%",
  },
  suggestionWrapper: {
    width: "47%",
  },
  suggestion: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
