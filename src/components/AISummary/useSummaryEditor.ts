import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Block, Summary } from '@/types';
import {
  addEmptySection,
  convertSummaryToMarkdown,
  deleteSelectedBlocks,
  ensureSummaryShape,
  findBlockLocation,
  generateSummaryBlockId,
  getAllBlocks,
  getBlockRange,
  getSelectedBlocksContent as selectedContentFromSummary,
  hasSummaryContent,
  MeetingSummaryMetadata,
  removeSection,
  updateBlockContent,
  updateBlockType,
} from './summaryEditorUtils';

interface UseSummaryEditorProps {
  summary: Summary | null;
  onSummaryChange: (summary: Summary) => void;
  meeting?: MeetingSummaryMetadata;
}

export function useSummaryEditor({ summary, onSummaryChange, meeting }: UseSummaryEditorProps) {
  const currentSummary = useMemo(() => ensureSummaryShape(summary), [summary]);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [lastSelectedBlock, setLastSelectedBlock] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartBlock, setDragStartBlock] = useState<string | null>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
  const [history, setHistory] = useState<Summary[]>([currentSummary]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [isUndoRedoing, setIsUndoRedoing] = useState(false);
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false });

  useEffect(() => {
    if (!isUndoRedoing && summary) {
      setHistory((currentHistory) => {
        const nextHistory = currentHistory.slice(0, currentHistoryIndex + 1);
        nextHistory.push(summary);
        setCurrentHistoryIndex(nextHistory.length - 1);
        return nextHistory;
      });
    }
    setIsUndoRedoing(false);
  }, [summary]);

  const handleUndo = useCallback(() => {
    if (currentHistoryIndex <= 0) return;

    setIsUndoRedoing(true);
    const newIndex = currentHistoryIndex - 1;
    setCurrentHistoryIndex(newIndex);
    onSummaryChange(history[newIndex]);
  }, [currentHistoryIndex, history, onSummaryChange]);

  const handleRedo = useCallback(() => {
    if (currentHistoryIndex >= history.length - 1) return;

    setIsUndoRedoing(true);
    const newIndex = currentHistoryIndex + 1;
    setCurrentHistoryIndex(newIndex);
    onSummaryChange(history[newIndex]);
  }, [currentHistoryIndex, history, onSummaryChange]);

  const getSelectedBlocksContent = useCallback(
    () => selectedContentFromSummary(currentSummary, selectedBlocks),
    [currentSummary, selectedBlocks]
  );

  const handleDeleteSelectedBlocks = useCallback(() => {
    onSummaryChange(deleteSelectedBlocks(currentSummary, selectedBlocks));
    setSelectedBlocks([]);
    setLastSelectedBlock(null);
  }, [currentSummary, onSummaryChange, selectedBlocks]);

  useEffect(() => {
    if (hiddenInputRef.current && selectedBlocks.length > 1) {
      hiddenInputRef.current.value = getSelectedBlocksContent();
      hiddenInputRef.current.select();
    }
  }, [getSelectedBlocksContent, selectedBlocks]);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        if (event.key === 'z') {
          event.preventDefault();
          if (event.shiftKey) handleRedo();
          else handleUndo();
        } else if (event.key === 'c') {
          navigator.clipboard.writeText(getSelectedBlocksContent());
        }
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedBlocks.length > 1) {
        event.preventDefault();
        handleDeleteSelectedBlocks();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [getSelectedBlocksContent, handleDeleteSelectedBlocks, handleRedo, handleUndo, selectedBlocks.length]);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu((current) => ({ ...current, visible: false }));
    document.addEventListener('click', closeContextMenu);
    return () => document.removeEventListener('click', closeContextMenu);
  }, []);

  const handleBlockNavigate = (blockId: string, direction: 'up' | 'down') => {
    const allBlocks = getAllBlocks(currentSummary);
    const currentIndex = allBlocks.findIndex((block) => block.id === blockId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up'
      ? Math.max(0, currentIndex - 1)
      : Math.min(allBlocks.length - 1, currentIndex + 1);
    if (targetIndex === currentIndex) return;

    const targetBlock = allBlocks[targetIndex];
    setSelectedBlocks([targetBlock.id]);
    setLastSelectedBlock(targetBlock.id);
  };

  const handleBlockMouseDown = (blockId: string, event: React.MouseEvent<HTMLDivElement>) => {
    if (!event.shiftKey) {
      setDragStartBlock(blockId);
      setLastSelectedBlock(blockId);
      setSelectedBlocks([blockId]);
    }
    setIsDragging(true);
  };

  const handleBlockMouseEnter = (blockId: string) => {
    if (isDragging && dragStartBlock) {
      setSelectedBlocks(getBlockRange(currentSummary, dragStartBlock, blockId));
    }
  };

  const handleBlockMouseUp = (blockId: string, event: React.MouseEvent<HTMLDivElement>) => {
    if (event.shiftKey && lastSelectedBlock) {
      setSelectedBlocks(getBlockRange(currentSummary, lastSelectedBlock, blockId));
    }
    setIsDragging(false);
  };

  const handleBlockChange = (sectionKey: string, blockId: string, newContent: string) => {
    onSummaryChange(updateBlockContent(currentSummary, sectionKey, blockId, newContent));
  };

  const handleBlockTypeChange = (blockId: string, newType: Block['type']) => {
    onSummaryChange(updateBlockType(currentSummary, blockId, newType));
  };

  const handleTitleChange = (sectionKey: string, newTitle: string) => {
    onSummaryChange({
      ...currentSummary,
      [sectionKey]: {
        ...currentSummary[sectionKey],
        title: newTitle,
      },
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent, _blockId: string) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedBlocks.length > 1) {
      event.preventDefault();
      handleDeleteSelectedBlocks();
    }
  };

  const handleCreateNewBlock = (blockId: string, newBlockContent: string, blockType: Block['type'], currentBlockContent?: string) => {
    const location = findBlockLocation(currentSummary, blockId);
    if (!location) return;

    const currentBlock = location.block;
    const newId = generateSummaryBlockId(location.sectionKey);
    const updatedBlocks = [...currentSummary[location.sectionKey].blocks];
    const newBlockType = blockType === 'bullet' ? 'bullet' : 'text';

    if (currentBlockContent !== undefined) {
      updatedBlocks[location.blockIndex] = {
        ...currentBlock,
        content: currentBlockContent,
      };
    }

    updatedBlocks.splice(location.blockIndex + 1, 0, {
      id: newId,
      type: newBlockType,
      content: newBlockContent,
      color: currentBlock.color || 'default',
    });

    onSummaryChange({
      ...currentSummary,
      [location.sectionKey]: {
        ...currentSummary[location.sectionKey],
        blocks: updatedBlocks,
      },
    });

    setSelectedBlocks([newId]);
    setLastSelectedBlock(newId);

    setTimeout(() => {
      const newTextarea = document.querySelector(`[data-block-id="${newId}"]`) as HTMLTextAreaElement;
      newTextarea?.focus();
      newTextarea?.setSelectionRange(0, 0);
    }, 0);
  };

  const handleBlockDelete = (blockId: string, mergeContent?: string) => {
    const location = findBlockLocation(currentSummary, blockId);
    if (!location) return;

    const updatedBlocks = [...currentSummary[location.sectionKey].blocks];
    if (mergeContent && location.blockIndex > 0) {
      const previousBlock = updatedBlocks[location.blockIndex - 1];
      const cursorPosition = previousBlock.content.length;

      updatedBlocks[location.blockIndex - 1] = {
        ...previousBlock,
        content: previousBlock.content + mergeContent,
      };
      updatedBlocks.splice(location.blockIndex, 1);

      onSummaryChange({
        ...currentSummary,
        [location.sectionKey]: {
          ...currentSummary[location.sectionKey],
          blocks: updatedBlocks,
        },
      });

      setSelectedBlocks([previousBlock.id]);
      setLastSelectedBlock(previousBlock.id);
      setTimeout(() => {
        const textarea = document.querySelector(`[data-block-id="${previousBlock.id}"]`) as HTMLTextAreaElement;
        textarea?.focus();
        textarea?.setSelectionRange(cursorPosition, cursorPosition);
      }, 0);
      return;
    }

    updatedBlocks.splice(location.blockIndex, 1);
    onSummaryChange({
      ...currentSummary,
      [location.sectionKey]: {
        ...currentSummary[location.sectionKey],
        blocks: updatedBlocks,
      },
    });

    if (updatedBlocks.length > 0) {
      const newSelectedBlock = updatedBlocks[Math.max(0, location.blockIndex - 1)];
      setSelectedBlocks([newSelectedBlock.id]);
      setLastSelectedBlock(newSelectedBlock.id);
    } else {
      setSelectedBlocks([]);
      setLastSelectedBlock(null);
    }
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    const menuWidth = 160;
    const menuHeight = 80;
    const x = Math.max(10, Math.min(event.clientX, window.innerWidth - menuWidth - 10));
    const y = Math.max(10, Math.min(event.clientY, window.innerHeight - menuHeight - 10));
    setContextMenu({ x, y, visible: true });
  };

  const handleCopyBlocks = useCallback(() => {
    navigator.clipboard.writeText(getSelectedBlocksContent());
    setContextMenu((current) => ({ ...current, visible: false }));
  }, [getSelectedBlocksContent]);

  const handleDeleteBlocks = () => {
    handleDeleteSelectedBlocks();
    setContextMenu((current) => ({ ...current, visible: false }));
  };

  const handleSectionDelete = (sectionKey: string) => {
    onSummaryChange(removeSection(currentSummary, sectionKey));
  };

  const handleAddSection = () => {
    const result = addEmptySection(currentSummary);
    onSummaryChange(result.summary);
    setSelectedBlocks([result.blockId]);
    setLastSelectedBlock(result.blockId);
  };

  const handleExport = () => {
    const markdown = convertSummaryToMarkdown(currentSummary, meeting);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentSummary.title || 'ai-summary'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
    contextMenu,
    currentHistoryIndex,
    currentSummary,
    getSelectedBlocksContent,
    handleAddSection,
    handleBlockChange,
    handleBlockDelete,
    handleBlockMouseDown,
    handleBlockMouseEnter,
    handleBlockMouseUp,
    handleBlockNavigate,
    handleBlockTypeChange,
    handleContextMenu,
    handleCopyBlocks,
    handleDeleteBlocks,
    handleExport,
    handleKeyDown,
    handleRedo,
    handleSectionDelete,
    handleTitleChange,
    handleUndo,
    handleCreateNewBlock,
    hasContent: hasSummaryContent(currentSummary),
    hiddenInputRef,
    history,
    selectedBlocks,
  };
}
