import { StreamLanguage, LanguageSupport } from '@codemirror/language';
import type { CompletionContext, CompletionSource } from '@codemirror/autocomplete';

// ---------------------------------------------------------------------------
// Keywords and builtins
// ---------------------------------------------------------------------------

export const SPROUT_KEYWORDS: readonly string[] = [
  'repeat', 'with', 'while', 'if', 'else', 'do', 'end',
  'let', 'set', 'loop', 'forever', 'for', 'each', 'in',
  'def', 'return', 'on', 'timer', 'every', 'fill', 'not',
  'and', 'or', 'true', 'false',
];

// Every function in the interpreter's BUILTINS map (packages/lang/src/interpreter.ts)
// plus the higher-order list builtins. Keep in sync when adding builtins.
export const SPROUT_BUILTINS: readonly string[] = [
  // Motion
  'forward', 'turn', 'arc', 'goto', 'home', 'stamp',
  'hideTurtle', 'showTurtle', 'getX', 'getY', 'getHeading',
  // Pen
  'penUp', 'penDown', 'color', 'randomColor', 'background',
  'clearCanvas', 'penWidth',
  // Shapes & composition
  'circle', 'rect', 'ellipse', 'triangle', 'polygon', 'text',
  'beside', 'above', 'scale',
  // Sprites
  'sprite', 'moveSprite', 'turnSprite', 'gotoSprite',
  'changeSpriteX', 'changeSpriteY', 'spriteX', 'spriteY',
  'spritesTouching', 'hideSprite', 'showSprite', 'removeSprite',
  'bounceSprite', 'cloneSprite',
  // Control / timing / sound
  'stopTimer', 'wait', 'beep', 'playNote',
  // Input
  'keyDown', 'mouseX', 'mouseY', 'textInput', 'input',
  'random', 'touching', 'distance',
  // Display
  'show', 'puts',
  // Math
  'sin', 'cos', 'tan', 'abs', 'sqrt', 'pow', 'mod',
  'log', 'floor', 'ceil', 'round', 'max', 'min', 'pi',
  // Strings
  'join', 'length', 'split', 'contains', 'toUpper', 'toLower',
  // Lists
  'list', 'range', 'at', 'get', 'first', 'last', 'pick',
  'indexOf', 'slice', 'size', 'isEmpty', 'push', 'pop',
  'concat', 'reverse', 'sort', 'map', 'filter', 'reduce',
];

const SPROUT_SYMBOLS: readonly string[] = [
  ':red', ':orange', ':yellow', ':green', ':blue', ':purple',
  ':white', ':black', ':gray', ':pink', ':cyan',
  ':left', ':right', ':up', ':down', ':space', ':enter', ':timer',
];

// ---------------------------------------------------------------------------
// StreamLanguage tokenizer for syntax highlighting
// ---------------------------------------------------------------------------

const KEYWORD_SET = new Set(SPROUT_KEYWORDS);

const sproutStreamLanguage = StreamLanguage.define<object>({
  name: 'sprout',
  token(stream) {
    if (stream.match(/^#.*/)) return 'comment';
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string';
    if (stream.match(/^\d+(\.\d+)?/)) return 'number';
    if (stream.match(/^:[a-zA-Z_]\w*/)) return 'atom';
    const ident = stream.match(/^[a-zA-Z_]\w*/);
    if (ident) {
      const word = (ident as RegExpMatchArray)[0];
      if (KEYWORD_SET.has(word)) return 'keyword';
      return 'variableName';
    }
    stream.next();
    return null;
  },
});

export const sproutLanguage = new LanguageSupport(sproutStreamLanguage);

// ---------------------------------------------------------------------------
// Autocomplete completion source
// ---------------------------------------------------------------------------

export const sproutCompletions: CompletionSource = (context: CompletionContext) => {
  const word = context.matchBefore(/[\w:]+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const typed = word.text;

  if (typed.startsWith(':')) {
    return {
      from: word.from,
      options: SPROUT_SYMBOLS.map(s => ({ label: s, type: 'constant' })),
    };
  }

  // User-defined names from the current document: let <name> / def <name>
  const docText = context.state.doc.toString();
  const userNames: string[] = [];
  for (const match of docText.matchAll(/(?:let|def)\s+([a-zA-Z_]\w*)/g)) {
    if (match[1] && !userNames.includes(match[1])) {
      userNames.push(match[1]);
    }
  }

  return {
    from: word.from,
    options: [
      ...SPROUT_BUILTINS.map(b => ({ label: b, type: 'function' })),
      ...SPROUT_KEYWORDS.map(k => ({ label: k, type: 'keyword' })),
      ...userNames.map(n => ({ label: n, type: 'variable' })),
    ],
  };
};
