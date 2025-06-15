import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import SheetSelectBox, { SheetSelectOption, SheetSelectBoxRef } from '@/components/common/SheetSelectBox';
import { useMcpStore, StoredMcpTool, useStoredTools } from '@/store/mcpStore';
import { useRouter } from 'expo-router';
import ToolsIcon from '../icons/ToolsIcon';

/**
 * McpToolSelectorButton
 *
 * Shows a + icon. When pressed, opens a SheetSelectBox listing MCP tools from the default server.
 * Minimal logic: just show the selector and close on select. No design changes to input area.
 */
const McpToolSelectorButton: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
  const { colors } = useTheme();
  const selectBoxRef = useRef<SheetSelectBoxRef>(null);
  const [selectedValue, setSelectedValue] = useState<string[]>([]);
  const router = useRouter();

  // Use the stable, typed selector
  const tools = useStoredTools() ?? [];
  const setTools = useMcpStore((s) => s.setTools);


  // Group tools by domain/category (e.g., domain from tool.name or tool.category if available)
  const options: SheetSelectOption[] = useMemo(() =>
    tools.map((tool: StoredMcpTool) => {
      // Extract domain as category (e.g., "domain:tool" or fallback to 'General')
      let category = 'General';
      if (tool.name.includes(':')) {
        category = tool.name.split(':')[0];
      } else if ((tool as any).category) {
        category = (tool as any).category;
      }
      return {
        label:  tool.description ? `${tool.description}` : tool.name,
        value: tool.name,
        searchTerms: tool.description || '',
        category,
      };
    }),
    [tools]
  );

  // Preselect active tools
  const activeToolNames = useMemo(() => tools.filter(t => t.isActive).map(t => t.name), [tools]);

  // On first mount, if no tools are active, select all by default
  useEffect(() => {
    if (tools.length > 0 && activeToolNames.length === 0) {
      setSelectedValue(tools.map(t => t.name));
      setTools(tools.map(t => ({ ...t, isActive: true })));
      console.log('[McpToolSelectorButton] No active tools, activating all:', tools.map(t => t.name));
    } else {
      setSelectedValue(activeToolNames);
      console.log('[McpToolSelectorButton] Active tool names:', activeToolNames);
    }
  }, [tools.length]);

  const handleOpen = useCallback(() => {
    if (!disabled) selectBoxRef.current?.openSheet();
  }, [disabled]);

  const handleValueChange = useCallback((value: string | number | Array<string | number> | null) => {
    let newValue: string[];
    if (Array.isArray(value)) {
      newValue = value.filter((v): v is string => typeof v === 'string');
    } else if (typeof value === 'string') {
      newValue = [value];
    } else {
      newValue = [];
    }
    setSelectedValue(newValue);
    // Update active state in store
    const updatedTools = tools.map(tool => ({
      ...tool,
      isActive: newValue.includes(tool.name),
    }));
    setTools(updatedTools);
    console.log('[McpToolSelectorButton] handleValueChange, new active tools:', newValue);
  }, [tools, setTools]);

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open attachments"
        style={{ justifyContent: 'center', alignItems: 'center', width: 36, height: 36 }}
        disabled={disabled}
        onPress={handleOpen}
      >
        <ToolsIcon size={22} color={colors.icon} />
      </TouchableOpacity>
      <SheetSelectBox
        ref={selectBoxRef}
        triggerless
        multiselect
        options={options}
        searchable={false}
        selectedValue={selectedValue}
        onValueChange={handleValueChange}
        placeholder="Select a tool"
        modalTitle="Select MCP Tool"
        headerButtonIcon="server-outline"
        headerButtonLabel="Add MCP Server"
        onHeaderButtonPress={() => router.push('/editMcpConnectionSheet')}
      />
    </>
  );
};

export default React.memo(McpToolSelectorButton); 