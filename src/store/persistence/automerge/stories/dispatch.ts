import {DocHandleChangePayload} from '@automerge/vanillajs';
import {Thunk} from 'react-hook-thunk-reducer';
import {
	StoriesAction,
	StoriesState,
	Story
} from '../../../stories/stories.types';

let dispatch:
	| React.Dispatch<StoriesAction | Thunk<StoriesState, StoriesAction>>
	| undefined = undefined;

/**
 * Glue code connecting us with local stories context.
 */
export function setDispatch(newDispatch: typeof dispatch) {
	dispatch = newDispatch;
}

/**
 * Handles an Automerge doc handle's change event, dispatching actions locally
 * where possible.
 */
export function dispatchChangeFromAutomergeDoc(
	event: DocHandleChangePayload<Story>
) {
	if (!dispatch) {
		console.warn(
			"Can't handle Automerge change because no dispatch function is set"
		);
		return;
	}

	console.log('Dispatching updateStory action from Automerge');
	dispatch({
		type: 'updateStory',
		storyId: event.doc.id,
		// prevent `existing document` error from re-inserting a tracked object
		props: structuredClone(event.doc),
		source: 'persistence'
	});
}
