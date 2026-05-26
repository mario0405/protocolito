import { useState, useEffect, useCallback } from 'react';
import { invoke as invokeTauri } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';
import { DEFAULT_SUMMARY_TEMPLATE_ID, SUMMARY_TEMPLATE_STORAGE_KEY } from '@/constants/summaryTemplates';

export function useTemplates(initialTemplateId?: string | null) {
  const [availableTemplates, setAvailableTemplates] = useState<Array<{
    id: string;
    name: string;
    description: string;
  }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(() => {
    if (initialTemplateId) return initialTemplateId;
    if (typeof window === 'undefined') return DEFAULT_SUMMARY_TEMPLATE_ID;
    return localStorage.getItem(SUMMARY_TEMPLATE_STORAGE_KEY) || DEFAULT_SUMMARY_TEMPLATE_ID;
  });

  useEffect(() => {
    if (initialTemplateId) {
      setSelectedTemplate(initialTemplateId);
    }
  }, [initialTemplateId]);

  // Fetch available templates on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const templates = await invokeTauri('list_summary_templates') as Array<{
          id: string;
          name: string;
          description: string;
        }>;
        console.log('Available templates:', templates);
        setAvailableTemplates(Array.isArray(templates) ? templates : []);
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      }
    };
    fetchTemplates();
  }, []);

  // Handle template selection
  const handleTemplateSelection = useCallback((templateId: string, templateName: string) => {
    setSelectedTemplate(templateId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SUMMARY_TEMPLATE_STORAGE_KEY, templateId);
    }
    toast.success('Template selected', {
      description: `Using "${templateName}" template for summary generation`,
    });
    Analytics.trackFeatureUsed('template_selected');
  }, []);

  return {
    availableTemplates,
    selectedTemplate,
    handleTemplateSelection,
  };
}
