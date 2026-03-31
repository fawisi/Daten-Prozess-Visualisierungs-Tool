import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table2, GitBranch, X } from 'lucide-react';
import type { DiagramFile } from './AppSidebar.js';

interface OpenTab {
  file: DiagramFile;
}

interface DiagramTabsProps {
  tabs: OpenTab[];
  activeTab: string | null;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
}

export function DiagramTabs({ tabs, activeTab, onTabSelect, onTabClose }: DiagramTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-border bg-card/50">
      <Tabs value={activeTab ?? undefined} onValueChange={onTabSelect} className="w-full">
        <TabsList className="h-9 w-full justify-start rounded-none border-0 bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.file.path}
              value={tab.file.path}
              className="relative h-9 rounded-none border-b-2 border-transparent px-3 font-mono text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              {tab.file.type === 'erd' ? (
                <Table2 className="mr-1.5 h-3 w-3" />
              ) : (
                <GitBranch className="mr-1.5 h-3 w-3" />
              )}
              {tab.file.name}
              <span
                role="button"
                tabIndex={0}
                className="ml-2 rounded p-0.5 hover:bg-accent cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.file.path);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onTabClose(tab.file.path);
                }}
              >
                <X className="h-3 w-3" />
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
