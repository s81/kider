// loadProgram.ts — load Sprout text into a Blockly workspace as blocks.
//
// Shared by the Examples dropdown and text-share links. Returns false (with
// the workspace left empty) when the text doesn't parse or isn't
// representable as blocks — callers fall back to the text editor.

import type * as Blockly from 'blockly';
import { parse } from '@sprout/parser';
import { decompileProgram } from '@sprout/blocks';

export function tryLoadAsBlocks(ws: Blockly.Workspace, text: string): boolean {
  try {
    const program = parse(text);
    ws.clear();
    decompileProgram(ws, program);
    // Rendered workspaces need each programmatically-created block drawn;
    // headless workspaces (tests) have no SVG machinery.
    for (const block of ws.getAllBlocks(false)) {
      if ('initSvg' in block && typeof (block as Blockly.BlockSvg).initSvg === 'function') {
        (block as Blockly.BlockSvg).initSvg();
      }
    }
    if ('render' in ws && typeof (ws as Blockly.WorkspaceSvg).render === 'function') {
      (ws as Blockly.WorkspaceSvg).render();
    }
    return true;
  } catch {
    ws.clear();
    return false;
  }
}
