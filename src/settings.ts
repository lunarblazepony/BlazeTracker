import { ExtensionSettingsManager } from 'sillytavern-utils-lib';
import { EXTENSION_KEY } from './constants';

export interface BlazeTrackerSettings {
  profileId: string;
  autoMode: 'none' | 'responses' | 'inputs' | 'both';
  lastXMessages: number;
  maxResponseTokens: number;
}

export const defaultSettings: BlazeTrackerSettings = {
  profileId: '',
  autoMode: 'both',
  lastXMessages: 10,
  maxResponseTokens: 4000,
};

export const settingsManager = new ExtensionSettingsManager<BlazeTrackerSettings>(
  EXTENSION_KEY,
  defaultSettings
);
