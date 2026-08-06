import * as React from 'react';
import * as localStoragePrefs from '../local-storage/prefs';
import * as stories from './stories';
import * as localStorageStoryFormats from '../local-storage/story-formats';

// Use existing local storage for prefs and story formats, but back everything
// story-related with Automerge.

export function useAutomergePersistence() {
	return React.useMemo(
		() => ({
			prefs: {
				load: localStoragePrefs.load,
				saveMiddleware: localStoragePrefs.saveMiddleware
			},
			stories: {
				load: stories.load,
				saveMiddleware: stories.saveMiddleware,
				setDispatch: stories.setDispatch
			},
			storyFormats: {
				load: localStorageStoryFormats.load,
				saveMiddleware: localStorageStoryFormats.saveMiddleware
			}
		}),
		[]
	);
}
