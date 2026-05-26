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
    <div className="h-screen bg-stone-50 flex flex-col">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-stone-50 border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('common.back')}</span>
            </button>
              <h1 className="text-3xl font-semibold tracking-normal text-stone-950">{t('settings.title')}</h1>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8 pt-6">
          <div className="relative flex border-b border-gray-200">
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
                  className={`relative z-10 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${selected ? 'text-stone-950' : 'text-stone-500 hover:text-stone-900'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {t(tab.labelKey)}
                </button>
              );
            })}

            <motion.div
              className="absolute bottom-0 z-20 h-0.5 bg-orange-600"
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
