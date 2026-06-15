import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSettings as fetchSettings, updateSettings as persistSettings } from '../services/dashboardApi';

export interface GlobalSettings {
  emailNotif: boolean;
  slackNotif: boolean;
  aiFailAlert: boolean;
  weeklyReport: boolean;
  autoEscalate: boolean;
  hallucinationDetect: boolean;
  autoFAQ: boolean;
  compactView: boolean;
  language: string;
  exportFormat: string;
  dataRetention: string;
  showAiFailed: boolean;
  sortBy: string;
  pageSize: string;
  channelZaloOA: boolean;
  channelZaloBiz: boolean;
  channelFacebook: boolean;
  channelWidget: boolean;
  alertFailRate: number;
  alertResponseTime: number;
  alertUncertainRate: number;
  dataSourceZalo: boolean;
  dataSourceZaloBiz: boolean;
  dataSourceFb: boolean;
  dataSourceWidget: boolean;
  dataSyncInterval: string;
}

const defaultSettings: GlobalSettings = {
  emailNotif: true, slackNotif: false, aiFailAlert: true, weeklyReport: true,
  autoEscalate: true, hallucinationDetect: true, autoFAQ: false,
  compactView: false, language: "vi", exportFormat: "xlsx", dataRetention: "90",
  showAiFailed: true, sortBy: "newest", pageSize: "20",
  channelZaloOA: true, channelZaloBiz: false, channelFacebook: true, channelWidget: false,
  alertFailRate: 15, alertResponseTime: 30, alertUncertainRate: 25,
  dataSourceZalo: true, dataSourceZaloBiz: true, dataSourceFb: true, dataSourceWidget: true, dataSyncInterval: "5",
};

interface SettingsContextType {
  settings: GlobalSettings;
  updateSetting: (key: keyof GlobalSettings, value: any) => void;
  saveSettings: () => Promise<GlobalSettings>;
  reloadSettings: () => Promise<GlobalSettings>;
  loadingSettings: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
const SETTINGS_STORAGE_KEY = 'flic_dashboard_settings';

function cacheSettings(settings: GlobalSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Browser storage can be unavailable; backend persistence is still authoritative.
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GlobalSettings>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        try {
          return { ...defaultSettings, ...JSON.parse(stored) };
        } catch (e) {
          console.error("Failed to parse settings", e);
        }
      }
    }
    return defaultSettings;
  });
  const [loadingSettings, setLoadingSettings] = useState(false);

  const applySettings = (value: Record<string, any>) => {
    const merged = { ...defaultSettings, ...value } as GlobalSettings;
    setSettings(merged);
    cacheSettings(merged);
    return merged;
  };

  const reloadSettings = async () => {
    setLoadingSettings(true);
    try {
      const remote = await fetchSettings();
      return applySettings(remote);
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingSettings(true);
    fetchSettings()
      .then((remote) => {
        if (!cancelled) applySettings(remote);
      })
      .catch((err) => {
        console.error("Failed to load settings from backend", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingSettings(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = (key: keyof GlobalSettings, value: any) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      cacheSettings(updated);
      return updated;
    });
  };

  const saveSettings = async () => {
    const remote = await persistSettings(settings);
    return applySettings(remote);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, saveSettings, reloadSettings, loadingSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
