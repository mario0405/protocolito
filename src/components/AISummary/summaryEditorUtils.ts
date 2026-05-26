import type { Block, Summary } from '@/types';

export interface MeetingSummaryMetadata {
  id: string;
  title: string;
  created_at: string;
}

export interface SummaryBlockRef {
  id: string;
  sectionKey: string;
}

export function generateSummaryBlockId(sectionKey: string) {
  return `${sectionKey}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function defaultSummary(): Summary {
  return {
    Agenda: { title: 'Agenda', blocks: [] },
    Decisions: { title: 'Decisions', blocks: [] },
    ActionItems: { title: 'Action Items', blocks: [] },
    ClosingRemarks: { title: 'Closing Remarks', blocks: [] },
  };
}

export function ensureSummaryShape(summary: Summary | null): Summary {
  if (!summary) return defaultSummary();

  return Object.entries(summary).reduce<Summary>((normalized, [sectionKey, section]) => {
    normalized[sectionKey] = {
      title: section?.title || sectionKey,
      blocks: Array.isArray(section?.blocks)
        ? section.blocks.map((block) => ({
          ...block,
          id: block.id.includes(sectionKey) ? block.id : generateSummaryBlockId(sectionKey),
        }))
        : [],
    };
    return normalized;
  }, {});
}

export function getAllBlocks(summary: Summary): SummaryBlockRef[] {
  return Object.entries(summary).flatMap(([sectionKey, section]) =>
    section.blocks.map((block) => ({ id: block.id, sectionKey }))
  );
}

export function getBlockRange(summary: Summary, startId: string, endId: string) {
  const allBlocks = getAllBlocks(summary);
  const startIndex = allBlocks.findIndex((block) => block.id === startId);
  const endIndex = allBlocks.findIndex((block) => block.id === endId);

  if (startIndex === -1 || endIndex === -1) return [];

  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);
  return allBlocks.slice(start, end + 1).map((block) => block.id);
}

export function findBlockLocation(summary: Summary, blockId: string) {
  for (const [sectionKey, section] of Object.entries(summary)) {
    const blockIndex = section.blocks.findIndex((block) => block.id === blockId);
    if (blockIndex !== -1) {
      return {
        block: section.blocks[blockIndex],
        blockIndex,
        sectionKey,
      };
    }
  }

  return null;
}

export function updateBlockContent(summary: Summary, sectionKey: string, blockId: string, content: string): Summary {
  return {
    ...summary,
    [sectionKey]: {
      ...summary[sectionKey],
      blocks: summary[sectionKey].blocks.map((block) =>
        block.id === blockId ? { ...block, content } : block
      ),
    },
  };
}

export function updateBlockType(summary: Summary, blockId: string, type: Block['type']): Summary {
  const location = findBlockLocation(summary, blockId);
  if (!location) return summary;

  return {
    ...summary,
    [location.sectionKey]: {
      ...summary[location.sectionKey],
      blocks: summary[location.sectionKey].blocks.map((block) =>
        block.id === blockId ? { ...block, type } : block
      ),
    },
  };
}

export function deleteSelectedBlocks(summary: Summary, selectedBlockIds: string[]): Summary {
  const selected = new Set(selectedBlockIds);

  return Object.entries(summary).reduce<Summary>((nextSummary, [sectionKey, section]) => {
    nextSummary[sectionKey] = {
      ...section,
      blocks: section.blocks.filter((block) => !selected.has(block.id)),
    };
    return nextSummary;
  }, {});
}

export function getSelectedBlocksContent(summary: Summary, selectedBlockIds: string[]) {
  return selectedBlockIds
    .map((blockId) => findBlockLocation(summary, blockId)?.block.content || '')
    .filter(Boolean)
    .join('\n');
}

export function removeSection(summary: Summary, sectionKey: string): Summary {
  const nextSummary = { ...summary };
  delete nextSummary[sectionKey];
  return nextSummary;
}

export function addEmptySection(summary: Summary): { summary: Summary; blockId: string } {
  const sectionKey = `section${Object.keys(summary).length + 1}`;
  const blockId = Date.now().toString();

  return {
    blockId,
    summary: {
      ...summary,
      [sectionKey]: {
        title: 'New Section',
        blocks: [{
          id: blockId,
          type: 'text',
          content: '',
          color: 'default',
        }],
      },
    },
  };
}

export function hasSummaryContent(summary: Summary) {
  return Object.values(summary).some((section) =>
    section?.blocks?.some((block) => block.content.trim())
  );
}

export function convertSummaryToMarkdown(summary: Summary, meeting?: MeetingSummaryMetadata) {
  let markdown = `# AI Generated Summary of Meeting: ${meeting?.id || 'Unknown'} - ${meeting?.title || 'Untitled Meeting'}\n\n`;
  markdown += `## Date: ${meeting?.created_at ? new Date(meeting.created_at).toLocaleDateString() : new Date().toLocaleDateString()}\n\n`;

  Object.entries(summary).forEach(([key, section]) => {
    if (key === 'title') {
      markdown = `# ${section.title || 'AI Enhanced Summary'}\n\n`;
      return;
    }

    markdown += `## ${section.title || key}\n\n`;
    section.blocks.forEach((block) => {
      switch (block.type) {
        case 'heading1':
          markdown += `### ${block.content}\n\n`;
          break;
        case 'heading2':
          markdown += `#### ${block.content}\n\n`;
          break;
        case 'bullet':
          markdown += `- ${block.content}\n`;
          break;
        case 'text':
        default:
          markdown += `${block.content}\n\n`;
      }
    });

    if (section.blocks.some((block) => block.type === 'bullet')) {
      markdown += '\n';
    }
  });

  return markdown;
}
