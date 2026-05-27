'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Settings, ChevronRightCircle, Calendar, Home, Mic, Square, NotebookPen, SearchIcon, X, Upload } from 'lucide-react';
import { useRouter, usePathname } from '@/lib/vite-shims/navigation';
import { useSidebar } from './SidebarProvider';
import type { CurrentMeeting } from '@/components/Sidebar/SidebarProvider';
import { ConfirmationModal } from '../ConfirmationModel/confirmation-modal';
import Analytics from '@/lib/analytics';
import { invoke } from '@tauri-apps/api/core';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import { useConfig } from '@/contexts/ConfigContext';
import { cn } from '@/lib/utils';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"

import Logo from '../Logo';
import Info from '../Info';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../ui/input-group';
import { ensureFolderExpanded, filterSidebarItems, type SidebarItem as SidebarTreeItem } from './sidebarUtils';
import { SidebarItem } from './SidebarItem';
import { MeetingNoteRow } from './MeetingNoteRow';

const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentMeeting,
    setCurrentMeeting,
    sidebarItems,
    isCollapsed,
    toggleCollapse,
    handleRecordingToggle,
    searchTranscripts,
    searchResults,
    isSearching,
    meetings,
    setMeetings
  } = useSidebar();

  // Get recording state from RecordingStateContext (single source of truth)
  const { isRecording } = useRecordingState();
  const { openImportDialog } = useImportDialog();
  const { betaFeatures, t } = useConfig();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['meetings']));
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State for edit modal
  const [editModalState, setEditModalState] = useState<{ isOpen: boolean; meetingId: string | null; currentTitle: string }>({
    isOpen: false,
    meetingId: null,
    currentTitle: ''
  });
  const [editingTitle, setEditingTitle] = useState<string>('');

  // Ensure 'meetings' folder is always expanded
  useEffect(() => {
    setExpandedFolders((current) => ensureFolderExpanded(current, 'meetings'));
  }, []);

  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; itemId: string | null }>({ isOpen: false, itemId: null });

  // Handle search input changes
  const handleSearchChange = useCallback(async (value: string) => {
    setSearchQuery(value);

    // If search query is empty, just return to normal view
    if (!value.trim()) return;

    // Search through transcripts
    await searchTranscripts(value);

    // Make sure the meetings folder is expanded when searching
    setExpandedFolders((current) => ensureFolderExpanded(current, 'meetings'));
  }, [searchTranscripts]);

  // Combine search results with sidebar items
  const filteredSidebarItems = useMemo(() => {
    return filterSidebarItems(sidebarItems, searchQuery, searchResults);
  }, [sidebarItems, searchQuery, searchResults]);


  const handleDelete = async (itemId: string) => {
    console.log('Deleting item:', itemId);
    const payload = {
      meetingId: itemId
    };

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('api_delete_meeting', {
        meetingId: itemId,
      });
      console.log('Meeting deleted successfully');
      const updatedMeetings = meetings.filter((m: CurrentMeeting) => m.id !== itemId);
      setMeetings(updatedMeetings);

      // Track meeting deletion
      Analytics.trackMeetingDeleted(itemId);

      // Show success toast
      toast.success(t('sidebar.meetingDeleted'), {
        description: t('sidebar.meetingDeletedDescription')
      });

      // If deleting the active meeting, navigate to home
      if (currentMeeting?.id === itemId) {
        setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      toast.error(t('sidebar.deleteMeetingFailed'), {
        description: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteModalState.itemId) {
      handleDelete(deleteModalState.itemId);
    }
    setDeleteModalState({ isOpen: false, itemId: null });
  };

  // Handle modal editing of meeting names
  const handleEditStart = (meetingId: string, currentTitle: string) => {
    setEditModalState({
      isOpen: true,
      meetingId: meetingId,
      currentTitle: currentTitle
    });
    setEditingTitle(currentTitle);
  };

  const handleEditConfirm = async () => {
    const newTitle = editingTitle.trim();
    const meetingId = editModalState.meetingId;

    if (!meetingId) return;

    // Prevent empty titles
    if (!newTitle) {
      toast.error(t('sidebar.meetingTitleRequired'));
      return;
    }

    try {
      await invoke('api_save_meeting_title', {
        meetingId: meetingId,
        title: newTitle,
      });

      // Update local state
      const updatedMeetings = meetings.map((m: CurrentMeeting) =>
        m.id === meetingId ? { ...m, title: newTitle } : m
      );
      setMeetings(updatedMeetings);

      // Update current meeting if it's the one being edited
      if (currentMeeting?.id === meetingId) {
        setCurrentMeeting({ id: meetingId, title: newTitle });
      }

      // Track the edit
      Analytics.trackButtonClick('edit_meeting_title', 'sidebar');

      toast.success(t('sidebar.meetingTitleUpdated'));

      // Close modal and reset state
      setEditModalState({ isOpen: false, meetingId: null, currentTitle: '' });
      setEditingTitle('');
    } catch (error) {
      console.error('Failed to update meeting title:', error);
      toast.error(t('sidebar.meetingTitleUpdateFailed'), {
        description: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleEditCancel = () => {
    setEditModalState({ isOpen: false, meetingId: null, currentTitle: '' });
    setEditingTitle('');
  };

  const toggleFolder = (folderId: string) => {
    // Normal toggle behavior for all folders
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const openMeetingNotes = () => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      next.add('meetings');
      return next;
    });
    if (isCollapsed) toggleCollapse();
    router.push('/');
  };

  // Expose setShowModelSettings to window for Rust tray to call
  useEffect(() => {
    (window as any).openSettings = () => {
      router.push('/settings');
    };

    // Cleanup on unmount
    return () => {
      delete (window as any).openSettings;
    };
  }, [router]);

  const renderCollapsedIcons = () => {
    if (!isCollapsed) return null;

    const isHomePage = pathname === '/';
    const isMeetingPage = pathname?.includes('/meeting-details');
    const isSettingsPage = pathname === '/settings';
    const isSearchPage = pathname === '/search';

    return (
      <TooltipProvider>
        <div className="flex flex-col items-center gap-4 pt-4">
          <Logo isCollapsed={isCollapsed} />

          <SidebarItem
            collapsed
            icon={Home}
            label={t('common.home')}
            active={isHomePage}
            onClick={() => router.push('/')}
          />

          <SidebarItem
            collapsed
            prominent
            icon={isRecording ? Square : Mic}
            label={isRecording ? t('sidebar.recordingInProgress') : t('home.startRecording')}
            disabled={isRecording}
            onClick={handleRecordingToggle}
          />

          {betaFeatures.importAndRetranscribe && (
            <SidebarItem
              collapsed
              icon={Upload}
              label={t('sidebar.importAudio')}
              onClick={() => openImportDialog()}
            />
          )}

          <SidebarItem
            collapsed
            icon={SearchIcon}
            label={t('common.search')}
            active={isSearchPage}
            onClick={() => router.push('/search')}
          />

          <SidebarItem
            collapsed
            icon={NotebookPen}
            label={t('sidebar.meetingNotes')}
            active={isMeetingPage}
            onClick={openMeetingNotes}
          />

          <SidebarItem
            collapsed
            icon={Settings}
            label={t('common.settings')}
            active={isSettingsPage}
            onClick={() => router.push('/settings')}
          />

          <Info isCollapsed={isCollapsed} />
        </div>
      </TooltipProvider>
    );
  };

  // Find matching transcript snippet for a meeting item
  const findMatchingSnippet = (itemId: string) => {
    if (!searchQuery.trim() || !searchResults.length) return null;
    return searchResults.find(result => result.id === itemId);
  };

  const renderItem = (item: SidebarTreeItem, depth = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    const paddingLeft = `${depth * 12 + 12}px`;
    const isActive = item.type === 'file' && currentMeeting?.id === item.id;
    const isMeetingItem = item.id.includes('-') && !item.id.startsWith('intro-call');

    // Check if this item has a matching transcript snippet
    const matchingResult = isMeetingItem ? findMatchingSnippet(item.id) : null;
    const hasTranscriptMatch = !!matchingResult;

    if (isCollapsed) return null;

    if (item.type !== 'folder') {
      return (
        <div key={item.id}>
          <MeetingNoteRow
            title={item.title}
            active={isActive || hasTranscriptMatch}
            isMeeting={isMeetingItem}
            dateLabel={item.dateLabel}
            depth={depth}
            editLabel={t('sidebar.editMeetingTitle')}
            deleteLabel={t('sidebar.deleteMeeting')}
            onOpen={() => {
              setCurrentMeeting({ id: item.id, title: item.title });
              const basePath = item.id.startsWith('intro-call') ? '/' :
                item.id.includes('-') ? `/meeting-details?id=${item.id}` : `/notes/${item.id}`;
              router.push(basePath);
            }}
            onEdit={() => handleEditStart(item.id, item.title)}
            onDelete={() => setDeleteModalState({ isOpen: true, itemId: item.id })}
          />

          {hasTranscriptMatch && (
            <div className="ml-8 mt-1 rounded border border-yellow-200/20 bg-white/10 p-1.5 text-xs text-stone-400 line-clamp-2">
              <span className="font-medium text-amber-300">{t('sidebar.match')}</span> {matchingResult.matchContext}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={item.id}>
        <motion.div
          layout
          className={cn(
            'group flex items-center transition-colors',
            depth === 0
              ? 'mx-3 mt-3 h-10 rounded-lg p-3 text-sm font-semibold text-[var(--pt-text-secondary)]'
              : 'my-0.5 cursor-pointer rounded-lg px-3 py-2 text-sm text-[var(--pt-text-secondary)] hover:bg-[var(--pt-bg-secondary)] hover:text-[var(--pt-text-primary)]',
          )}
          style={depth === 0 ? {} : { paddingLeft }}
          onClick={() => toggleFolder(item.id)}
        >
              {item.id === 'meetings' ? (
                <Calendar className="w-4 h-4 mr-2" />
              ) : item.id === 'notes' ? (
                <Calendar className="w-4 h-4 mr-2" />
              ) : null}
              <span className={depth === 0 ? "" : "font-medium"}>{item.title}</span>
              <div className="ml-auto">
                {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-[var(--pt-text-muted)]" />
                ) : (
                <ChevronRight className="h-4 w-4 text-[var(--pt-text-muted)]" />
                )}
              </div>
              {searchQuery && item.id === 'meetings' && isSearching && (
                <span className="ml-2 text-xs text-blue-500 animate-pulse">{t('sidebar.searching')}</span>
              )}
        </motion.div>
        {item.type === 'folder' && isExpanded && item.children && (
          <div className="ml-1">
            {item.children.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed top-0 left-0 h-screen z-40">
      {/* Floating collapse button */}
      <motion.button
        onClick={toggleCollapse}
        aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        animate={{ rotate: isCollapsed ? 0 : 180 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className="pt-glass absolute -right-4 top-20 z-50 rounded-full p-1 text-[var(--pt-text-primary)] hover:bg-[var(--pt-bg-elevated)]"
      >
        <ChevronRightCircle className="h-6 w-6" />
      </motion.button>

      <motion.div
        layout
        animate={{ width: isCollapsed ? 56 : 240 }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className="pt-glass flex h-screen flex-col overflow-hidden border-y-0 border-l-0 text-[var(--pt-text-primary)]"
      >
        {/*  Header with traffic light spacing */}
        <div className="flex-shrink-0 h-22 flex items-center">

          {/* Title container */}



          <div className="flex-1">
            <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="sidebar-expanded-header"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="p-3"
              >
                <Logo isCollapsed={isCollapsed} />

                <div className="relative mb-1">
                  <InputGroup >
                    <InputGroupInput placeholder={t('sidebar.searchPlaceholder')} value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                    />
                    <InputGroupAddon>
                      <SearchIcon />
                    </InputGroupAddon>
                    {searchQuery &&
                      <InputGroupAddon align={'inline-end'}>
                        <InputGroupButton
                          onClick={() => handleSearchChange('')}
                        >
                          <X />
                        </InputGroupButton>
                      </InputGroupAddon>
                    }
                  </InputGroup>
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>

        {/* Main content - scrollable area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Fixed navigation items */}
          <div className="flex-shrink-0">
            {!isCollapsed && (
              <div
                onClick={() => router.push('/')}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') router.push('/');
                }}
                className="mx-3 mt-3 flex h-10 cursor-pointer items-center rounded-lg p-3 text-sm font-medium text-[var(--pt-text-secondary)] hover:bg-[var(--pt-bg-secondary)] hover:text-[var(--pt-text-primary)]"
              >
                <Home className="w-4 h-4 mr-2" />
                <span>{t('common.home')}</span>
              </div>
            )}
            {!isCollapsed && (
              <div
                onClick={() => router.push('/search')}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') router.push('/search');
                }}
                className={cn('mx-3 mt-1 flex h-10 cursor-pointer items-center rounded-lg p-3 text-sm font-medium text-[var(--pt-text-secondary)] hover:bg-[var(--pt-bg-secondary)] hover:text-[var(--pt-text-primary)]', pathname === '/search' && 'bg-[var(--pt-bg-secondary)] text-[var(--pt-text-primary)]')}
              >
                <SearchIcon className="w-4 h-4 mr-2" />
                <span>{t('common.search')}</span>
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 flex flex-col min-h-0">
            {renderCollapsedIcons()}
            {/* Meeting Notes folder header - fixed */}
            {!isCollapsed && (
              <div className="flex-shrink-0">
                {filteredSidebarItems.filter(item => item.type === 'folder').map(item => (
                  <div key={item.id}>
                    <div className="mx-3 mt-3 flex h-10 items-center rounded-lg p-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--pt-text-muted)]">
                      <NotebookPen className="mr-2 h-4 w-4 text-[var(--pt-text-muted)]" />
                      <span>{item.title}</span>
                      {searchQuery && item.id === 'meetings' && isSearching && (
                        <span className="ml-2 text-xs text-blue-500 animate-pulse">{t('sidebar.searching')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Scrollable meeting items */}
            {!isCollapsed && (
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                {filteredSidebarItems
                  .filter(item => item.type === 'folder' && expandedFolders.has(item.id) && item.children)
                  .map(item => (
                    <motion.div
                      key={`${item.id}-children`}
                      className="mx-3"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        visible: { transition: { staggerChildren: 0.025 } },
                        hidden: {},
                      }}
                    >
                      {item.children!.map(child => renderItem(child, 1))}
                    </motion.div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {!isCollapsed && (

          <div className="flex-shrink-0 border-t border-[var(--pt-border)] p-2">
            <button
              onClick={handleRecordingToggle}
              disabled={isRecording}
              aria-label={isRecording ? t('sidebar.recordingInProgress') : t('home.startRecording')}
              className={cn('flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-white transition-colors', isRecording ? 'bg-red-400 cursor-not-allowed' : 'bg-[var(--pt-brand)] hover:bg-[var(--pt-brand-strong)] pt-coral-glow')}
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  <span>{t('sidebar.recordingInProgress')}</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  <span>{t('home.startRecording')}</span>
                </>
              )}
            </button>

            {betaFeatures.importAndRetranscribe && (
              <button
                onClick={() => openImportDialog()}
                aria-label={t('sidebar.importAudio')}
              className="mt-1 flex w-full items-center justify-center rounded-xl bg-[var(--pt-bg-secondary)] px-3 py-2 text-sm font-medium text-[var(--pt-text-secondary)] transition-colors hover:text-[var(--pt-text-primary)]"
              >
                <Upload className="w-4 h-4 mr-2" />
                <span>{t('sidebar.importAudio')}</span>
              </button>
            )}

            <button
              onClick={() => router.push('/settings')}
              aria-label={t('common.settings')}
              className="mb-1 mt-1 flex w-full items-center justify-center rounded-xl px-3 py-1.5 text-sm font-medium text-[var(--pt-text-secondary)] transition-colors hover:bg-[var(--pt-bg-secondary)] hover:text-[var(--pt-text-primary)]"
            >
              <Settings className="w-4 h-4 mr-2" />
              <span>{t('common.settings')}</span>
            </button>
            <Info isCollapsed={isCollapsed} />
            <div className="w-full flex items-center justify-center px-3 py-1 text-xs text-gray-400">
              v0.3.0 Beta
            </div>
          </div>
        )}
      </motion.div>

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        text={t('sidebar.deleteMeetingConfirm')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalState({ isOpen: false, itemId: null })}
      />

      {/* Edit Meeting Title Modal */}
      <Dialog open={editModalState.isOpen} onOpenChange={(open) => {
        if (!open) handleEditCancel();
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <VisuallyHidden>
            <DialogTitle>{t('sidebar.editMeetingTitle')}</DialogTitle>
          </VisuallyHidden>
          <div className="py-4">
            <h3 className="text-lg font-semibold mb-4">{t('sidebar.editMeetingTitle')}</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="meeting-title" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('sidebar.meetingTitle')}
                </label>
                <input
                  id="meeting-title"
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleEditConfirm();
                    } else if (e.key === 'Escape') {
                      handleEditCancel();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('sidebar.enterMeetingTitle')}
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={handleEditCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleEditConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              {t('common.save')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sidebar;
