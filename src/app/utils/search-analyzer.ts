export interface SearchEngineAnalyzer {
  analyze(text: string, query: string): boolean;
}

export class SimpleContainsAnalyzer implements SearchEngineAnalyzer {
  analyze(text: string, query: string): boolean {
    if (!text || !query) return false;
    return text.toLowerCase().includes(query.toLowerCase());
  }
}

export class SearchEngineFactory {
  static getSearchEngineAnalyzer(engineType: string | null | undefined): SearchEngineAnalyzer {
    // Defensive Runtime Fallback Guard: default to SIMPLE_CONTAINS if null/undefined/empty
    let type = engineType;
    if (type === null || type === undefined || type.trim() === '') {
      type = 'SIMPLE_CONTAINS';
    }

    switch (type.toUpperCase()) {
      case 'SIMPLE_CONTAINS':
        return new SimpleContainsAnalyzer();
      default:
        throw new Error(`Search engine ${engineType} is not supported`);
    }
  }
}
