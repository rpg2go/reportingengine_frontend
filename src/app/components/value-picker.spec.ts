import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, ElementRef } from '@angular/core';
import { ValuePickerComponent } from './value-picker';

describe('ValuePickerComponent', () => {
  let component: ValuePickerComponent;
  let mockElementRef: any;

  beforeEach(() => {
    mockElementRef = {
      nativeElement: {
        contains: vi.fn().mockReturnValue(false)
      }
    };

    const injector = Injector.create({
      providers: [
        { provide: ElementRef, useValue: mockElementRef }
      ]
    });

    runInInjectionContext(injector, () => {
      component = new ValuePickerComponent();
    });
  });

  it('should initialize with isOpen false and empty selection', () => {
    expect(component.isOpen()).toBe(false);
    expect(component.selectedValues()).toEqual([]);
  });

  it('should toggle selection of a value', () => {
    // Add value
    component.toggleValueSelection('Value1');
    expect(component.selectedValues()).toEqual(['Value1']);

    // Add another
    component.toggleValueSelection('Value2');
    expect(component.selectedValues()).toEqual(['Value1', 'Value2']);

    // Remove first
    component.toggleValueSelection('Value1');
    expect(component.selectedValues()).toEqual(['Value2']);
  });

  it('should remove value when removeValue is called', () => {
    component.selectedValues.set(['ValueA', 'ValueB', 'ValueC']);
    const mockEvent = { stopPropagation: vi.fn() } as any;

    component.removeValue('ValueB', mockEvent);

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(component.selectedValues()).toEqual(['ValueA', 'ValueC']);
  });

  it('should filter values based on searchText', () => {
    vi.spyOn(component, 'availableValues').mockReturnValue(['apple', 'banana', 'orange']);
    
    // No search text
    component.searchText.set('');
    expect(component.filteredValues()).toEqual(['apple', 'banana', 'orange']);

    // Search matches 'an'
    component.searchText.set('an');
    expect(component.filteredValues()).toEqual(['banana', 'orange']);

    // Search mismatch
    component.searchText.set('xyz');
    expect(component.filteredValues()).toEqual([]);
  });

  it('should close on document click if clicked outside', () => {
    component.isOpen.set(true);
    mockElementRef.nativeElement.contains.mockReturnValue(false);

    const event = { target: {} } as any;
    component.onDocumentClick(event);

    expect(component.isOpen()).toBe(false);
  });

  it('should not close on document click if clicked inside', () => {
    component.isOpen.set(true);
    mockElementRef.nativeElement.contains.mockReturnValue(true);

    const event = { target: {} } as any;
    component.onDocumentClick(event);

    expect(component.isOpen()).toBe(true);
  });
});
