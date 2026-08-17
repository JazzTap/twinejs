import {
	AnyDocumentId,
	DocHandle
} from '@automerge/vanillajs';
import {Story, StoriesState, StoriesAction} from '../../../stories/stories.types';
import {Thunk} from 'react-hook-thunk-reducer';
import {dispatchChangeFromAutomergeDoc} from './dispatch';
import {
	allStoryDocHandles,
	loadStoryDocHandles,
	lookupRemoteHandle,
	repo,
	getOrCreateDocHandleForStory
} from './repo';

const attemptedLookups = new Set<string>();

/**
 * Initialize our local list of story documents, add change listeners, then
 * return all connected stories.
 */
export async function load(): Promise<Story[]> {
	await loadStoryDocHandles();

	const handles = allStoryDocHandles();

	for (const handle of handles) {
		handle.addListener('change', dispatchChangeFromAutomergeDoc);
	}

	return handles.map(docHandle => docHandle.doc());
}

export function ensureRemoteStory(routeKey: string): Thunk<StoriesState, StoriesAction> {
	return async (dispatch) => {
		if (attemptedLookups.has(routeKey)) return;
		attemptedLookups.add(routeKey);

		// StoryEditRoute already renders storyWithIfidOrPlaceholder()'s synthetic
		// placeholder while this is in flight — nothing to create here.

		const handle = await lookupRemoteHandle(routeKey) ;

		if (!handle) {
			return;
		}

		let doc: DocHandle<Story>;

		try {
			doc = await repo.find(handle as AnyDocumentId);
		} catch (error) {
			console.error(`Couldn't find document ${routeKey} in Automerge`, error);
			return;
		}

		const story = doc.doc()
		getOrCreateDocHandleForStory(story, doc);

		// Remote resolved — clear the placeholder and add the real story.
		// (FIXME: magic string matches provisional ID from `getters.ts`)
		dispatch({type: 'deleteStory', storyId: 'in-flight-placeholder'});
		dispatch({type: 'createStory', props: {...structuredClone(story), isProvisional: false}});
	};
}