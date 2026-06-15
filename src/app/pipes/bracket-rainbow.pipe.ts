import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'bracketRainbow',
  standalone: true
})
export class BracketRainbowPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    const colors = [
      'text-indigo-600',
      'text-emerald-600',
      'text-amber-500',
      'text-rose-500'
    ];

    let result = '';
    let depthCounter = 0;

    for (let i = 0; i < value.length; i++) {
      const char = value.charAt(i);
      if (char === '(') {
        const colorClass = colors[depthCounter % colors.length];
        result += `<span class="${colorClass} font-bold">(</span>`;
        depthCounter++;
      } else if (char === ')') {
        depthCounter--;
        const colorClass = colors[depthCounter % colors.length];
        result += `<span class="${colorClass} font-bold">)</span>`;
      } else {
        // Escaping HTML characters to prevent XSS
        if (char === '<') result += '&lt;';
        else if (char === '>') result += '&gt;';
        else if (char === '&') result += '&amp;';
        else result += char;
      }
    }

    return this.sanitizer.bypassSecurityTrustHtml(result);
  }
}
