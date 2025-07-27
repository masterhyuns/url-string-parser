export { useUrlQueryParser } from './hooks/useUrlQueryParser';
export { useParseState } from './hooks/useParseState';

export type { 
  ParseResult,
  ParsedParameter,
  ParsedSegment,
  ParsedQuery,
  ParameterType,
  ParameterFlags,
  TypeConverter,
  Encryptor,
  ATypeValue,
  BTypeValue
} from './types/parser.types';

export { 
  ATYPE_VALUES,
  BTYPE_VALUES,
  ParameterType as ParamType
} from './types/parser.types';

export { 
  parseUrlComponents,
  detectParameterType,
  parseFlags,
  extractValueWithBrackets,
  parseNestedStructure
} from './utils/parser.utils';

export { parseUrlSegments } from './parsers/urlParser';
export { parseQueryString } from './parsers/queryParser';

export { 
  transformParameter,
  transformSegments,
  transformQueries
} from './services/transformService';