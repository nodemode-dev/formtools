import type { DeskResult, DeskTool, OverlayParams } from '../io/desk';
import type { Hint } from './hint';
import type { Stage } from './stage';

export type Disposer = () => void;

export interface Clip { text?: string; png?: Uint8Array }

export interface BaseCtx {
  params: OverlayParams;
  hint: Hint;
  reduced: boolean;
  finish(result: DeskResult, clip?: Clip): Promise<void>;
  cancel(): Promise<void>;
  switchTo(tool: DeskTool): void;
}

export interface ToolCtx extends BaseCtx { stage: Stage }

export type ToolMount = (ctx: ToolCtx) => Disposer;
