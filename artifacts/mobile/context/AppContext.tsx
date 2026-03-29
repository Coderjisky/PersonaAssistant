import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Language = "en" | "hi";
export type ToneMode = "friendly" | "professional" | "romantic" | "casual";

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface UserProfile {
  name: string;
  language: Language;
  toneMode: ToneMode;
  autoReplyEnabled: boolean;
  autoReplyMessage: string;
}

interface AppContextValue {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  setCurrentConversation: (conv: Conversation | null) => void;
  saveConversation: (conv: Conversation) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  createNewConversation: () => Conversation;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "User",
  language: "en",
  toneMode: "friendly",
  autoReplyEnabled: false,
  autoReplyMessage: "Hi, I'm the assistant of {name}. They are currently busy. Please leave a message or contact later, and I'll help connect you.",
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

let convCounter = 0;
function generateId(): string {
  convCounter++;
  return `id-${Date.now()}-${convCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [profileStr, convsStr] = await Promise.all([
        AsyncStorage.getItem("user_profile"),
        AsyncStorage.getItem("conversations"),
      ]);

      if (profileStr) {
        setProfile(JSON.parse(profileStr));
      }
      if (convsStr) {
        const convs: Conversation[] = JSON.parse(convsStr);
        convs.sort((a, b) => b.updatedAt - a.updatedAt);
        setConversations(convs);
      }
    } catch (e) {
    } finally {
      setLoaded(true);
    }
  }

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    setProfile(prev => {
      const newProfile = { ...prev, ...updates };
      AsyncStorage.setItem("user_profile", JSON.stringify(newProfile)).catch(() => {});
      return newProfile;
    });
  }, []);

  const saveConversation = useCallback(async (conv: Conversation) => {
    setConversations(prev => {
      const existing = prev.findIndex(c => c.id === conv.id);
      let newConvs: Conversation[];
      if (existing >= 0) {
        newConvs = [...prev];
        newConvs[existing] = conv;
      } else {
        newConvs = [conv, ...prev];
      }
      newConvs.sort((a, b) => b.updatedAt - a.updatedAt);
      AsyncStorage.setItem("conversations", JSON.stringify(newConvs)).catch(() => {});
      return newConvs;
    });
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    setConversations(prev => {
      const newConvs = prev.filter(c => c.id !== id);
      AsyncStorage.setItem("conversations", JSON.stringify(newConvs)).catch(() => {});
      return newConvs;
    });
  }, []);

  const createNewConversation = useCallback((): Conversation => {
    return {
      id: generateId(),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }, []);

  if (!loaded) return null;

  return (
    <AppContext.Provider
      value={{
        profile,
        updateProfile,
        conversations,
        currentConversation,
        setCurrentConversation,
        saveConversation,
        deleteConversation,
        createNewConversation,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
