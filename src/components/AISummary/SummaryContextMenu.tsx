interface SummaryContextMenuProps {
  x: number;
  y: number;
  selectedCount: number;
  onCopy: () => void;
  onDelete: () => void;
}

export function SummaryContextMenu({ x, y, selectedCount, onCopy, onDelete }: SummaryContextMenuProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed z-50 bg-white shadow-lg rounded-lg py-1 min-w-[160px] border border-gray-200 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center space-x-2"
        onClick={onCopy}
      >
        <span className="text-gray-600">Copy</span>
        <span>{selectedCount > 1 ? `${selectedCount} blocks` : 'block'}</span>
      </button>
      <button
        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-red-600 flex items-center space-x-2"
        onClick={onDelete}
      >
        <span>Delete</span>
        <span>{selectedCount > 1 ? `${selectedCount} blocks` : 'block'}</span>
      </button>
    </div>
  );
}
