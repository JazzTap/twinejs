import * as React from 'react';
import {Thunk} from 'react-hook-thunk-reducer';
import {useAutomergePersistence} from './automerge/use-automerge-persistence';
import {useElectronIpcPersistence} from './electron-ipc/use-electron-ipc-persistence';
import {isElectronRenderer} from '../../util/is-electron';
import {StoriesAction, StoriesState} from '../stories';
import {StoryFormatsAction, StoryFormatsState} from '../story-formats';
import {PrefsAction, PrefsState} from '../prefs';

export interface PersistenceHooks {
	prefs: {
		load: () => Promise<Partial<PrefsState>>;
		saveMiddleware: (state: PrefsState, action: PrefsAction) => void;
	};
	stories: {
		load: () => Promise<StoriesState>;
		saveMiddleware: (
			state: StoriesState,
			action: StoriesAction,
			formats: StoryFormatsState
		) => void;
		setDispatch?: (
			dispatch: React.Dispatch<
				StoriesAction | Thunk<StoriesState, StoriesAction>
			>
		) => void;
	};
	storyFormats: {
		load: () => Promise<StoryFormatsState>;
		saveMiddleware: (
			state: StoryFormatsState,
			action: StoryFormatsAction
		) => void;
	};
}

export function usePersistence(): PersistenceHooks {
	const electronIpcPersistence = useElectronIpcPersistence();
	const automergePersistence = useAutomergePersistence();

	return React.useMemo(
		() =>
			isElectronRenderer() ? electronIpcPersistence : automergePersistence,
		[automergePersistence, electronIpcPersistence]
	);
}
