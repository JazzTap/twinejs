import * as React from 'react';
import {useState, useRef, useCallback} from 'react';
import useThunkReducer from 'react-hook-thunk-reducer';
import {usePersistence} from '../persistence/use-persistence';
import {reducer} from './reducer';
import {
	StoriesContextProps,
	StoriesAction,
	StoriesState
} from './stories.types';
import { AutomergeUrl, Repo, useDocument } from '../../../automerge-repo/packages/automerge-react';
import {useStoryFormatsContext} from '../story-formats';
import {useStoreErrorReporter} from '../use-store-error-reporter';
import {storyWithId} from "./"
import { Story } from './stories.types';

export const StoriesContext = React.createContext<StoriesContextProps>({
	dispatch: () => {},
	stories: [],
	storyUrl: {current: undefined},
});

StoriesContext.displayName = 'Stories';

export const useStoriesContext = () => React.useContext(StoriesContext);

export const StoriesContextProvider: React.FC<{repo: Repo}> = props => {
	const {stories: storiesPersistence} = usePersistence();
	const {formats} = useStoryFormatsContext();
	const {reportError} = useStoreErrorReporter();
  	const storyUrl = useRef<AutomergeUrl | undefined>(undefined);
	const changeStoryUrl = useCallback(() => {
		// TODO
	}, [])
	const [doc, changeDoc] =
		useDocument<Story>(storyUrl.current, props.repo, { suspense: false });

	const persistedReducer: React.Reducer<
		StoriesState,
		StoriesAction
	> = React.useMemo(
		() => (state, action) => {
			const newState = reducer(state, action);

			// TODO: mp tinewjs focused on updatePassage and updatePassages during proof of concept
			console.log("saveMiddleware")

			console.log(newState)
			console.log(action)
			// const story = storyWithId(newState, action.storyId);
			changeDoc((d: Story) => {
				
			})

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
		<StoriesContext.Provider value={{dispatch, stories, storyUrl}}>
			{props.children}
		</StoriesContext.Provider>
	);
};
