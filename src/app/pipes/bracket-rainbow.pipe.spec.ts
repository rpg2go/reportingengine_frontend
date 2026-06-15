import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { BracketRainbowPipe } from './bracket-rainbow.pipe';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

describe('BracketRainbowPipe', () => {
  let pipe: BracketRainbowPipe;
  let mockSanitizer: DomSanitizer;

  beforeEach(() => {
    mockSanitizer = {
      bypassSecurityTrustHtml: (value: string) => value as any
    } as DomSanitizer;
    pipe = new BracketRainbowPipe(mockSanitizer);
  });

  it('should return empty string for null, undefined or empty input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('should escape HTML characters', () => {
    const output = pipe.transform('<div>hello</div>');
    expect(output).toBe('&lt;div&gt;hello&lt;/div&gt;');
  });

  it('should wrap single parentheses in depth 0 style class', () => {
    const output = pipe.transform('(test)');
    expect(output).toBe('<span class="text-indigo-600 font-bold">(</span>test<span class="text-indigo-600 font-bold">)</span>');
  });

  it('should handle nested parentheses and apply rainbow colors by depth', () => {
    // (depth 0 (depth 1 (depth 2 (depth 3 (depth 0)))))
    const inputStr = '(((())))';
    const output = pipe.transform(inputStr) as string;
    
    // Depth 0: Indigo
    // Depth 1: Emerald
    // Depth 2: Amber
    // Depth 3: Rose
    expect(output).toContain('text-indigo-600 font-bold');
    expect(output).toContain('text-emerald-600 font-bold');
    expect(output).toContain('text-amber-500 font-bold');
    expect(output).toContain('text-rose-500 font-bold');
  });
});
