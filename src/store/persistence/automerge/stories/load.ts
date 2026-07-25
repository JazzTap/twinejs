import {Story} from '../../../stories/stories.types';
import {dispatchChangeFromAutomergeDoc} from './dispatch';
import {allStoryDocHandles, loadStoryDocHandles} from './repo';

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
