import * as React from 'react';
import useThunkReducer from 'react-hook-thunk-reducer';
import {usePersistence} from '../persistence/use-persistence';
import {reducer} from './reducer';
import {
	StoriesContextProps,
	StoriesAction,
	StoriesState
} from './stories.types';
import { AutomergeUrl, useDocument } from '../../../automerge-repo/packages/automerge-react';
import {useStoryFormatsContext} from '../story-formats';
import {useStoreErrorReporter} from '../use-store-error-reporter';
import { Story } from './stories.types';

export const StoriesContext = React.createContext<StoriesContextProps>({
	dispatch: () => {},
	stories: [],
	currentStoryUrl: {current: undefined},
});

StoriesContext.displayName = 'Stories';

export const useStoriesContext = () => React.useContext(StoriesContext);

export const StoriesContextProvider: React.FC = props => {
	const {stories: storiesPersistence} = usePersistence();
	const {formats} = useStoryFormatsContext();
	const {reportError} = useStoreErrorReporter();
  	const currentStoryUrl = React.useRef<AutomergeUrl | undefined>(undefined);
	const [doc, changeDoc] = useDocument<Story>(currentStoryUrl.current, {
		// don't use suspense; currentStoryUrl only gets defined after we load a StoryEditRoute
		suspense: false,
	});

	const persistedReducer: React.Reducer<
		StoriesState,
		StoriesAction
	> = React.useMemo(
		() => (state, action) => {
			const newState = reducer(state, action);

			// TODO: mp tinewjs focused on updatePassage and updatePassages during proof of concept
			console.log("saveMiddleware", state, action)

			// then persist through the browser / Electron middleware:
			try {
				storiesPersistence.saveMiddleware(newState, action, formats);
			} catch (error) {
				reportError(error as Error, 'store.errors.cantPersistStories');
			}

			return newState;
		},
		[formats, reportError, storiesPersistence]
	);
	const [stories, dispatch] = useThunkReducer(persistedReducer, []);

	return ( 
		<StoriesContext.Provider value={{dispatch, stories, currentStoryUrl}}>
			{props.children}
		</StoriesContext.Provider>
	);
};
