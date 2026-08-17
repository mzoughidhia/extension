import { AutomationRun } from '../models/automation-run.model';
import { CanonicalQuoteRequest } from '../models/canonical-data.model';
import { FieldMapping } from '../models/field-mapping.model';
import { FormMemory } from '../models/form-memory.model';
import { GeminiMappingRequest, GeminiMappingResponse } from '../models/gemini-schema.model';
import { QuoteSession } from '../models/quote-session.model';

export type ExtensionMessageType =
  | 'DETECT_FIELDS'
  | 'FIELDS_DETECTED'
  | 'GET_QUOTE_DATA'
  | 'QUOTE_DATA_RESPONSE'
  | 'SET_QUOTE_DATA'
  | 'EXECUTE_FILL'
  | 'FILL_COMPLETED'
  | 'UPDATE_MAPPING_STATUS'
  | 'PING'
  | 'PONG'
  | 'ANALYZE_WITH_GEMINI'
  | 'GEMINI_ANALYSIS_RESPONSE'
  | 'SET_GEMINI_API_KEY'
  | 'GET_GEMINI_API_KEY'
  | 'CLEAR_GEMINI_API_KEY'
  | 'GET_FORM_MEMORY'
  | 'FORM_MEMORY_RESPONSE'
  | 'SAVE_FORM_MEMORY'
  | 'DELETE_FORM_MEMORY'
  | 'CLEAR_FORM_MEMORY'
  | 'GET_QUOTE_SESSION'
  | 'QUOTE_SESSION_RESPONSE'
  | 'SAVE_QUOTE_SESSION'
  | 'DELETE_QUOTE_SESSION'
  | 'LIST_QUOTE_SESSIONS'
  | 'QUOTE_SESSIONS_LIST_RESPONSE'
  | 'RESUME_SESSION'
  | 'RESET_SESSION'
  | 'AUTO_STEP_DETECTED'
  | 'CLICK_NEXT_STEP';

export interface BaseMessage {
  type: ExtensionMessageType;
}

export interface DetectFieldsMessage extends BaseMessage {
  type: 'DETECT_FIELDS';
  quoteData?: CanonicalQuoteRequest;
}

export interface FieldsDetectedMessage extends BaseMessage {
  type: 'FIELDS_DETECTED';
  run: AutomationRun;
}

export interface GetQuoteDataMessage extends BaseMessage {
  type: 'GET_QUOTE_DATA';
}

export interface QuoteDataResponseMessage extends BaseMessage {
  type: 'QUOTE_DATA_RESPONSE';
  data: CanonicalQuoteRequest;
}

export interface SetQuoteDataMessage extends BaseMessage {
  type: 'SET_QUOTE_DATA';
  data: CanonicalQuoteRequest;
}

export interface ExecuteFillMessage extends BaseMessage {
  type: 'EXECUTE_FILL';
  mappings: FieldMapping[];
}

export interface FillCompletedMessage extends BaseMessage {
  type: 'FILL_COMPLETED';
  run: AutomationRun;
}

export interface UpdateMappingStatusMessage extends BaseMessage {
  type: 'UPDATE_MAPPING_STATUS';
  elementId: string;
  newStatus: FieldMapping['status'];
  newCanonicalPath?: FieldMapping['canonicalPath'];
}

export interface PingMessage extends BaseMessage {
  type: 'PING';
}

export interface PongMessage extends BaseMessage {
  type: 'PONG';
}

export interface AnalyzeWithGeminiMessage extends BaseMessage {
  type: 'ANALYZE_WITH_GEMINI';
  request: GeminiMappingRequest;
}

export interface GeminiAnalysisResponseMessage extends BaseMessage {
  type: 'GEMINI_ANALYSIS_RESPONSE';
  success: boolean;
  response?: GeminiMappingResponse;
  error?: string;
  errorCode?: string;
}

export interface SetGeminiApiKeyMessage extends BaseMessage {
  type: 'SET_GEMINI_API_KEY';
  apiKey: string;
}

export interface GetGeminiApiKeyMessage extends BaseMessage {
  type: 'GET_GEMINI_API_KEY';
}

export interface ClearGeminiApiKeyMessage extends BaseMessage {
  type: 'CLEAR_GEMINI_API_KEY';
}

export interface GetFormMemoryMessage extends BaseMessage {
  type: 'GET_FORM_MEMORY';
  memoryKey: string;
}

export interface FormMemoryResponseMessage extends BaseMessage {
  type: 'FORM_MEMORY_RESPONSE';
  memory: FormMemory | null;
}

export interface SaveFormMemoryMessage extends BaseMessage {
  type: 'SAVE_FORM_MEMORY';
  memory: FormMemory;
}

export interface DeleteFormMemoryMessage extends BaseMessage {
  type: 'DELETE_FORM_MEMORY';
  memoryKey: string;
}

export interface ClearFormMemoryMessage extends BaseMessage {
  type: 'CLEAR_FORM_MEMORY';
}

export interface GetQuoteSessionMessage extends BaseMessage {
  type: 'GET_QUOTE_SESSION';
  sessionId: string;
}

export interface QuoteSessionResponseMessage extends BaseMessage {
  type: 'QUOTE_SESSION_RESPONSE';
  session: QuoteSession | null;
}

export interface SaveQuoteSessionMessage extends BaseMessage {
  type: 'SAVE_QUOTE_SESSION';
  session: QuoteSession;
}

export interface DeleteQuoteSessionMessage extends BaseMessage {
  type: 'DELETE_QUOTE_SESSION';
  sessionId: string;
}

export interface ListQuoteSessionsMessage extends BaseMessage {
  type: 'LIST_QUOTE_SESSIONS';
  sessionKey: string;
}

export interface QuoteSessionsListResponseMessage extends BaseMessage {
  type: 'QUOTE_SESSIONS_LIST_RESPONSE';
  sessions: QuoteSession[];
}

export interface ResumeSessionMessage extends BaseMessage {
  type: 'RESUME_SESSION';
  sessionId: string;
}

export interface ResetSessionMessage extends BaseMessage {
  type: 'RESET_SESSION';
}

export interface AutoStepDetectedMessage extends BaseMessage {
  type: 'AUTO_STEP_DETECTED';
  run: AutomationRun;
}

export interface ClickNextStepMessage extends BaseMessage {
  type: 'CLICK_NEXT_STEP';
}

export type ExtensionMessage =
  | DetectFieldsMessage
  | FieldsDetectedMessage
  | GetQuoteDataMessage
  | QuoteDataResponseMessage
  | SetQuoteDataMessage
  | ExecuteFillMessage
  | FillCompletedMessage
  | UpdateMappingStatusMessage
  | PingMessage
  | PongMessage
  | AnalyzeWithGeminiMessage
  | GeminiAnalysisResponseMessage
  | SetGeminiApiKeyMessage
  | GetGeminiApiKeyMessage
  | ClearGeminiApiKeyMessage
  | GetFormMemoryMessage
  | FormMemoryResponseMessage
  | SaveFormMemoryMessage
  | DeleteFormMemoryMessage
  | ClearFormMemoryMessage
  | GetQuoteSessionMessage
  | QuoteSessionResponseMessage
  | SaveQuoteSessionMessage
  | DeleteQuoteSessionMessage
  | ListQuoteSessionsMessage
  | QuoteSessionsListResponseMessage
  | ResumeSessionMessage
  | ResetSessionMessage
  | AutoStepDetectedMessage
  | ClickNextStepMessage;
