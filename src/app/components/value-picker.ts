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
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      box-sizing: border-box;
    }

    .picker-input-housing:hover, .picker-input-housing.is-focused {
      border-color: #6366f1;
      background: rgba(15, 23, 42, 0.8);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
    }

    .chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
      flex: 1;
    }

    .placeholder-text {
      color: #64748b;
      font-size: 12px;
      user-select: none;
    }

    .value-chip {
      display: inline-flex;
      align-items: center;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #e2e8f0;
      font-size: 11px;
      font-weight: 500;
      padding: 1px 6px;
      border-radius: 4px;
      gap: 4px;
      transition: all 0.15s ease;
    }

    .value-chip:hover {
      background: rgba(99, 102, 241, 0.25);
      color: #ffffff;
    }

    .chip-delete-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 9px;
      padding: 0 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
    }

    .chip-delete-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ef4444;
    }

    .arrow-indicator {
      display: flex;
      align-items: center;
      color: #64748b;
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
      background: #0f172a;
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6);
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
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .dropdown-search-input {
      width: 100%;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      padding: 4px 8px;
      color: #e2e8f0;
      font-size: 11px;
      outline: none;
      transition: all 0.15s ease;
      box-sizing: border-box;
    }

    .dropdown-search-input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
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
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
    .dropdown-options-list::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .dropdown-option-item {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      color: #cbd5e1;
      font-size: 11px;
      transition: all 0.15s ease;
      gap: 6px;
      user-select: none;
    }

    .dropdown-option-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
    }

    .dropdown-option-item.is-selected {
      background: rgba(99, 102, 241, 0.1);
      color: #818cf8;
    }

    .checkbox-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      color: #818cf8;
      font-size: 10px;
      font-weight: bold;
      transition: all 0.15s ease;
    }

    .dropdown-option-item.is-selected .checkbox-indicator {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.2);
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
      color: #64748b;
      font-size: 11px;
    }
  `]
})
export class ValuePickerComponent {
  availableValues = input<string[]>([]);
  selectedValues = model<string[]>([]);
  placeholder = input<string>('Select values...');

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
    const current = this.selectedValues() || [];
    if (current.includes(value)) {
      this.selectedValues.set(current.filter(val => val !== value));
    } else {
      this.selectedValues.set([...current, value]);
    }
  }

  removeValue(value: string, event: MouseEvent) {
    event.stopPropagation();
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
