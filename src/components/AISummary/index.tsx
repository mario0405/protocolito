'use client';

import type { Summary } from '@/types';
import { Section } from './Section';
import { EmptyCompletedSummary, SummaryStatusPanel } from './SummaryStatusPanel';
import { SummaryContextMenu } from './SummaryContextMenu';
import { MeetingSummaryMetadata } from './summaryEditorUtils';
import { useSummaryEditor } from './useSummaryEditor';

interface Props {
  summary: Summary | null;
  status: 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';
  error: string | null;
  onSummaryChange: (summary: Summary) => void;
  onRegenerateSummary: () => void;
  meeting?: MeetingSummaryMetadata;
}

export const AISummary = ({ summary, status, error, onSummaryChange, meeting }: Props) => {
  const editor = useSummaryEditor({ summary, onSummaryChange, meeting });

  if (error || status === 'processing' || status === 'summarizing' || status === 'regenerating') {
    return <SummaryStatusPanel status={status} error={error} />;
  }

  if (!editor.hasContent && status === 'completed') {
    return <EmptyCompletedSummary />;
  }

  return (
    <div className="relative">
      {editor.selectedBlocks.length > 1 && (
        <textarea
          ref={editor.hiddenInputRef}
          className="sr-only"
          readOnly
          value={editor.getSelectedBlocksContent()}
          tabIndex={-1}
        />
      )}

      {editor.contextMenu.visible && (
        <SummaryContextMenu
          x={editor.contextMenu.x}
          y={editor.contextMenu.y}
          selectedCount={editor.selectedBlocks.length}
          onCopy={editor.handleCopyBlocks}
          onDelete={editor.handleDeleteBlocks}
        />
      )}

      {Object.keys(editor.currentSummary)
        .filter((key) => editor.currentSummary[key]?.blocks?.length > 0)
        .map((key) => (
          <Section
            key={key}
            section={editor.currentSummary[key]}
            sectionKey={key}
            selectedBlocks={editor.selectedBlocks}
            onBlockTypeChange={editor.handleBlockTypeChange}
            onBlockChange={(blockId, content) => editor.handleBlockChange(key, blockId, content)}
            onBlockMouseDown={(blockId, event) => editor.handleBlockMouseDown(blockId, event)}
            onBlockMouseEnter={(blockId) => editor.handleBlockMouseEnter(blockId)}
            onBlockMouseUp={(blockId, event) => editor.handleBlockMouseUp(blockId, event)}
            onKeyDown={editor.handleKeyDown}
            onTitleChange={editor.handleTitleChange}
            onSectionDelete={editor.handleSectionDelete}
            onBlockDelete={editor.handleBlockDelete}
            onContextMenu={editor.handleContextMenu}
            onBlockNavigate={(blockId, direction) => editor.handleBlockNavigate(blockId, direction)}
            onCreateNewBlock={editor.handleCreateNewBlock}
          />
        ))}
    </div>
  );
};
