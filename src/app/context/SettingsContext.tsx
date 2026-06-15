import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);
const SETTINGS_STORAGE_KEY = 'flic_dashboard_settings';

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

  const updateSetting = (key: keyof GlobalSettings, value: any) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      if (typeof window !== 'undefined') {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
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
