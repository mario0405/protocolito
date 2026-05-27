'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { ArrowLeft, Settings2, Mic, Database as DatabaseIcon, SparkleIcon, Plug } from 'lucide-react';
import { useRouter } from '@/lib/vite-shims/navigation';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { TranscriptSettings } from '@/components/TranscriptSettings';
import { RecordingSettings } from '@/components/RecordingSettings';
import { PreferenceSettings } from '@/components/PreferenceSettings';
import { SummaryModelSettings } from '@/components/SummaryModelSettings';
import { IntegrationsSettings } from '@/components/IntegrationsSettings';
import { useConfig } from '@/contexts/ConfigContext';
import { DEFAULT_WHISPER_MODEL } from '@/constants/modelDefaults';

// Tabs configuration (constant)
const TABS = [
  { value: 'general', labelKey: 'settings.general', icon: Settings2 },
  { value: 'recording', labelKey: 'settings.recordings', icon: Mic },
  { value: 'Transcriptionmodels', labelKey: 'settings.transcription', icon: DatabaseIcon },
  { value: 'summaryModels', labelKey: 'settings.summary', icon: SparkleIcon },
  { value: 'integrations', labelKey: 'settings.integrations', icon: Plug }
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { transcriptModelConfig, setTranscriptModelConfig, t } = useConfig();

  // Animation state for tabs
  const [activeTab, setActiveTab] = useState('general');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  // Load saved transcript configuration on mount
  useEffect(() => {
    const loadTranscriptConfig = async () => {
      try {
        const config = await invoke('api_get_transcript_config') as any;
        if (config) {
          console.log('Loaded saved transcript config:', config);
          setTranscriptModelConfig({
            provider: config.provider || 'localWhisper',
            model: config.model || DEFAULT_WHISPER_MODEL,
            productId: config.productId || null,
            modelName: config.modelName || null,
            apiKey: config.apiKey || null
          });
        }
      } catch (error) {
        console.error('Failed to load transcript config:', error);
      }
    };
    loadTranscriptConfig();
  }, [setTranscriptModelConfig]);

  // Update underline position when active tab changes
  useLayoutEffect(() => {
    const activeIndex = TABS.findIndex(tab => tab.value === activeTab);
    const activeTabElement = tabRefs.current[activeIndex];

    if (activeTabElement) {
      const { offsetLeft, offsetWidth } = activeTabElement;
      setUnderlineStyle({ left: offsetLeft, width: offsetWidth });
    }
  }, [activeTab]);

  return (
    <div className="flex h-screen flex-col pt-app-bg">
      {/* Fixed Header */}
      <div className="pt-glass sticky top-0 z-10 border-x-0 border-t-0">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-[var(--pt-text-secondary)] transition-colors hover:text-[var(--pt-text-primary)]"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('common.back')}</span>
            </button>
              <h1 className="text-3xl font-semibold tracking-normal text-[var(--pt-text-primary)]">{t('settings.title')}</h1>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8 pt-6">
          <div className="pt-glass relative flex overflow-hidden rounded-2xl p-1">
            {TABS.map((tab, index) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  ref={el => { tabRefs.current[index] = el }}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`settings-panel-${tab.value}`}
                  onClick={() => setActiveTab(tab.value)}
                  className={`relative z-10 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-colors ${selected ? 'text-[var(--pt-text-primary)]' : 'text-[var(--pt-text-muted)] hover:text-[var(--pt-text-primary)]'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {t(tab.labelKey)}
                </button>
              );
            })}

            <motion.div
              className="absolute bottom-1 top-1 z-0 rounded-xl bg-[var(--pt-bg-elevated)] shadow-sm"
              layoutId="underline"
              style={{ left: underlineStyle.left, width: underlineStyle.width }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            />
          </div>

          <div
            id={`settings-panel-${activeTab}`}
            role="tabpanel"
            className="mt-6"
          >
            {activeTab === 'general' && <PreferenceSettings />}
            {activeTab === 'recording' && <RecordingSettings />}
            {activeTab === 'Transcriptionmodels' && (
              <TranscriptSettings
                transcriptModelConfig={transcriptModelConfig}
                setTranscriptModelConfig={setTranscriptModelConfig}
              />
            )}
            {activeTab === 'summaryModels' && <SummaryModelSettings />}
            {activeTab === 'integrations' && <IntegrationsSettings />}
          </div>
        </div>
      </div>
    </div>
  );
};
