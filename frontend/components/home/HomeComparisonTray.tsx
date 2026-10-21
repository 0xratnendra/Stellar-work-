"use client";

import ComparisonBar from "@/components/ComparisonBar";

interface HomeComparisonTrayProps {
  selectedIds: number[];
  onRemove: (id: number) => void;
  onClear: () => void;
}

export default function HomeComparisonTray({
  selectedIds,
  onRemove,
  onClear,
}: HomeComparisonTrayProps) {
  return (
    <>
      {selectedIds.length > 0 && <div className="pb-20" aria-hidden="true" />}
      <ComparisonBar selectedIds={selectedIds} onRemove={onRemove} onClear={onClear} />
    </>
  );
}
