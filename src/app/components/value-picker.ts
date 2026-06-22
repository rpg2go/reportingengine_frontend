import { Component, ChangeDetectionStrategy, model, input, computed, signal, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-value-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './value-picker.html',
  styles: [`
    :host {
      display: block;
      width: 100%;
      position: relative;
    }

    :host.invalid-input .picker-input-housing {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.05);
    }

    .value-picker-container {
      position: relative;
      width: 100%;
    }

    /* Input Housing */
    .picker-input-housing {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 34px;
      padding: 4px 10px;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      box-sizing: border-box;
    }

    .picker-input-housing:hover, .picker-input-housing.is-focused {
      border-color: var(--color-apple-blue);
      background: var(--input-bg);
      box-shadow: 0 0 0 2px rgba(0, 118, 223, 0.25);
    }

    .chips-container {
      display: flex;
      flex-wrap: nowrap;
      gap: 6px;
      align-items: center;
      flex: 1;
      min-width: 0;
    }

    .placeholder-text {
      color: var(--color-apple-grey);
      font-size: 12px;
      user-select: none;
    }

    .value-chip {
      display: inline-flex;
      align-items: center;
      background: rgba(0, 118, 223, 0.15);
      border: 1px solid rgba(0, 118, 223, 0.3);
      color: var(--color-apple-text);
      font-size: 11px;
      font-weight: 500;
      padding: 1px 6px;
      border-radius: 4px;
      gap: 4px;
      transition: all 0.15s ease;
    }

    .value-chip:hover {
      background: rgba(0, 118, 223, 0.25);
      color: var(--color-apple-text);
    }

    .chip-delete-btn {
      background: transparent;
      border: none;
      color: var(--color-apple-grey);
      cursor: pointer;
      font-size: 9px;
      padding: 0 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
    }

    .chip-delete-btn:hover {
      background: var(--border-color);
      color: #ef4444;
    }

    .arrow-indicator {
      display: flex;
      align-items: center;
      color: var(--color-apple-grey);
      font-size: 8px;
      padding-left: 6px;
    }

    /* Floating Popover Drawer */
    .picker-dropdown-overlay {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 4px;
      background: var(--color-apple-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      box-shadow: var(--shadow-md);
      z-index: 50 !important;
      overflow: hidden;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      max-height: 250px;
      animation: fadeInPopover 0.15s ease-out;
    }

    @keyframes fadeInPopover {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .dropdown-search-wrapper {
      padding: 6px;
      border-bottom: 1px solid var(--border-color);
    }

    .dropdown-search-input {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 4px 8px;
      color: var(--color-apple-text);
      font-size: 11px;
      outline: none;
      transition: all 0.15s ease;
      box-sizing: border-box;
    }

    .dropdown-search-input:focus {
      border-color: var(--color-apple-blue);
      box-shadow: 0 0 0 2px rgba(0, 118, 223, 0.15);
    }

    .dropdown-options-list {
      overflow-y: auto;
      max-height: 200px;
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* Custom scrollbar for dropdown */
    .dropdown-options-list::-webkit-scrollbar {
      width: 6px;
    }
    .dropdown-options-list::-webkit-scrollbar-track {
      background: transparent;
    }
    .dropdown-options-list::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 3px;
    }
    .dropdown-options-list::-webkit-scrollbar-thumb:hover {
      background: var(--color-apple-grey);
    }

    .dropdown-option-item {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      color: var(--color-apple-text);
      font-size: 11px;
      transition: all 0.15s ease;
      gap: 6px;
      user-select: none;
    }

    .dropdown-option-item:hover {
      background: var(--border-color);
      color: var(--color-apple-text);
    }

    .dropdown-option-item.is-selected {
      background: rgba(0, 118, 223, 0.1);
      color: var(--color-apple-blue);
    }

    .checkbox-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border: 1px solid var(--border-color);
      border-radius: 3px;
      color: var(--color-apple-blue);
      font-size: 10px;
      font-weight: bold;
      transition: all 0.15s ease;
    }

    .dropdown-option-item.is-selected .checkbox-indicator {
      border-color: var(--color-apple-blue);
      background: rgba(0, 118, 223, 0.2);
    }

    .option-label {
      flex: 1;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }

    .no-options-message {
      padding: 12px;
      text-align: center;
      color: var(--color-apple-grey);
      font-size: 11px;
    }

    /* Light Theme overrides for value-picker component */
    :host-context(html.light) .picker-input-housing {
      background: #FFFFFF;
      border-color: #CBD5E1;
    }
    :host-context(html.light) .picker-input-housing:hover,
    :host-context(html.light) .picker-input-housing.is-focused {
      border-color: #6366F1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
    }
    :host-context(html.light) .placeholder-text {
      color: #64748B;
    }
    :host-context(html.light) .value-chip {
      background: #E0E7FF;
      border-color: #C7D2FE;
      color: #3730A3;
    }
    :host-context(html.light) .value-chip:hover {
      background: #C7D2FE;
      color: #312E81;
    }
    :host-context(html.light) .chip-delete-btn {
      color: #64748B;
    }
    :host-context(html.light) .chip-delete-btn:hover {
      background: #E2E8F0;
      color: #EF4444;
    }
    :host-context(html.light) .arrow-indicator {
      color: #475569;
    }
    :host-context(html.light) .picker-dropdown-overlay {
      background: #FFFFFF;
      border-color: #CBD5E1;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    }
    :host-context(html.light) .dropdown-search-wrapper {
      border-bottom-color: #E2E8F0;
    }
    :host-context(html.light) .dropdown-search-input {
      background: #FFFFFF;
      border-color: #CBD5E1;
      color: #0F172A;
    }
    :host-context(html.light) .dropdown-search-input:focus {
      border-color: #6366F1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
    }
    :host-context(html.light) .dropdown-option-item {
      color: #334155;
    }
    :host-context(html.light) .dropdown-option-item:hover {
      background: #F8FAFC;
      color: #0F172A;
    }
    :host-context(html.light) .dropdown-option-item.is-selected {
      background: #E0E7FF;
      color: #4338CA;
    }
    :host-context(html.light) .checkbox-indicator {
      border-color: #CBD5E1;
      color: #4338CA;
    }
    :host-context(html.light) .dropdown-option-item.is-selected .checkbox-indicator {
      border-color: #6366F1;
      background: #E0E7FF;
    }
    :host-context(html.light) .option-label {
      color: #334155;
    }
    :host-context(html.light) .no-options-message {
      color: #64748B;
    }

    /* Mock Tailwind classes for value wrapped input layout */
    .flex-1 { flex: 1 1 0% !important; }
    .bg-white { background-color: var(--color-apple-card) !important; }
    .border { border: 1px solid var(--border-color) !important; }
    .rounded-lg { border-radius: 0.5rem !important; }
    .px-2\\.5 { padding-left: 0.625rem !important; padding-right: 0.625rem !important; }
    .py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
    .flex { display: flex !important; }
    .flex-wrap { flex-wrap: wrap !important; }
    .gap-1 { gap: 0.25rem !important; }
    .items-center { align-items: center !important; }

    /* Popover menu positioning & constraints classes */
    .absolute { position: absolute !important; }
    .left-0 { left: 0 !important; }
    .right-0 { right: 0 !important; }
    .z-\\[1050\\] { z-index: 1050 !important; }
    .mt-1 { margin-top: 0.25rem !important; }
    .border-slate-200 { border-color: var(--border-color) !important; }
    .rounded-xl { border-radius: 0.75rem !important; }
    .shadow-xl { box-shadow: var(--shadow-card) !important; }
    .max-h-\\[220px\\] { max-height: 220px !important; }
    .overflow-y-auto { overflow-y: auto !important; }
    .p-1 { padding: 0.25rem !important; }
    .flex-col { flex-direction: column !important; }
    .gap-0\\.5 { gap: 0.125rem !important; }

    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: var(--color-apple-grey);
    }
  `]
})
export class ValuePickerComponent {
  availableValues = input<string[]>([]);
  selectedValues = model<string[]>([]);
  placeholder = input<string>('Select values...');
  disabled = input<boolean>(false);

  isOpen = signal<boolean>(false);
  searchText = signal<string>('');

  private elementRef = inject(ElementRef);

  filteredValues = computed(() => {
    const search = this.searchText().toLowerCase().trim();
    const available = this.availableValues() || [];
    if (!search) return available;
    return available.filter(val => 
      val && val.toString().toLowerCase().includes(search)
    );
  });

  toggleValueSelection(value: string) {
    if (this.disabled()) return;
    const current = this.selectedValues() || [];
    if (current.includes(value)) {
      this.selectedValues.set(current.filter(val => val !== value));
    } else {
      this.selectedValues.set([...current, value]);
    }
  }

  removeValue(value: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.disabled()) return;
    const current = this.selectedValues() || [];
    this.selectedValues.set(current.filter(val => val !== value));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.isOpen.set(false);
    }
  }
}
