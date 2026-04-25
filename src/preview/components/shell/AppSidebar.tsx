import React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table2, GitBranch, FileJson, Network } from 'lucide-react';
import type { DiagramType } from '../../../types.js';

export interface DiagramFile {
  name: string;
  path: string;
  type: DiagramType;
}

interface AppSidebarProps {
  files: DiagramFile[];
  activeFile: string | null;
  onFileSelect: (file: DiagramFile) => void;
  selectedElement?: { type: string; label: string; properties: Record<string, string> } | null;
}

export function AppSidebar({ files, activeFile, onFileSelect, selectedElement }: AppSidebarProps) {
  const erdFiles = files.filter((f) => f.type === 'erd');
  const bpmnFiles = files.filter((f) => f.type === 'bpmn');
  const landscapeFiles = files.filter((f) => f.type === 'landscape');

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/20 flex items-center justify-center">
            <FileJson className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-mono text-sm font-semibold text-sidebar-foreground">
            viso
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="flex-1">
          {/* ER Diagrams */}
          {erdFiles.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-wider">
                ER Diagrams
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {erdFiles.map((file) => (
                    <SidebarMenuItem key={file.path}>
                      <SidebarMenuButton
                        isActive={file.path === activeFile}
                        onClick={() => onFileSelect(file)}
                        className="font-mono text-xs"
                      >
                        <Table2 className="h-4 w-4" />
                        <span>{file.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Process Diagrams */}
          {bpmnFiles.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-wider">
                Process Diagrams
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {bpmnFiles.map((file) => (
                    <SidebarMenuItem key={file.path}>
                      <SidebarMenuButton
                        isActive={file.path === activeFile}
                        onClick={() => onFileSelect(file)}
                        className="font-mono text-xs"
                      >
                        <GitBranch className="h-4 w-4" />
                        <span>{file.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* System Landscape (v1.1.1 — CR-3) */}
          {landscapeFiles.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-wider">
                System Landscape
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {landscapeFiles.map((file) => (
                    <SidebarMenuItem key={file.path}>
                      <SidebarMenuButton
                        isActive={file.path === activeFile}
                        onClick={() => onFileSelect(file)}
                        className="font-mono text-xs"
                      >
                        <Network className="h-4 w-4" />
                        <span>{file.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </ScrollArea>

        {/* Properties Panel */}
        {selectedElement && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-wider">
                Properties
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="px-2 space-y-2">
                  {Object.entries(selectedElement.properties).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground uppercase">
                        {key}
                      </span>
                      <span className="font-mono text-xs text-sidebar-foreground">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
