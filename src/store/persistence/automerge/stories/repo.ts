import {
	AnyDocumentId,
	BroadcastChannelNetworkAdapter,
	DocHandle,
	IndexedDBStorageAdapter,
	Repo
} from '@automerge/vanillajs';
import {Story} from '../../../stories/stories.types';

/**
 * Shared repo for all Automerge documents.
 */
export const repo = new Repo({
	// Using local broadcast only for now; can't communicate with external
	// server when running on localhost without CORS being set up over there.
	network: [
		// @ts-expect-error FIXME: why does TypeScript dislike this?
		new BroadcastChannelNetworkAdapter()
	],
	storage: new IndexedDBStorageAdapter()
});

// Exposing it globally for debugging.
window.repo = repo;

/**
 * A local map of story IFIDs -> Automerge doc handles, so that we reuse the
 * same document where possible. We persist this to local storage as IFID ->
 * Automerge document URLs but hydrate it back to doc handles.
 */
const storyAutomergeDocs: Record<string, DocHandle<Story>> = {};

/**
 * Loads the map of story IFIDs -> Automerge doc handles from local storage.
 */
export async function loadStoryDocHandles() {
	const savedUrls = window.localStorage.getItem('twine-TEST-automerge-urls');

	if (savedUrls) {
		let parsedSavedUrls = {};

		try {
			parsedSavedUrls = JSON.parse(savedUrls);
		} catch {
			console.error("Couldn't parse Automerge URL map in local storage");
		}

		for (const key in parsedSavedUrls) {
			try {
				storyAutomergeDocs[key] = await repo.find(
					parsedSavedUrls[key] as AnyDocumentId
				);
			} catch {
				console.error(`Couldn't find document ${key} in Automerge; skipping`);
			}
		}
	}
}

/**
 * Saves the map of story IFIDs -> Automerge doc handles to local storage.
 */
export function saveStoryDocHandles() {
	const serialized: Record<string, string> = {};

	for (const key in storyAutomergeDocs) {
		serialized[key] = storyAutomergeDocs[key].url;
	}

	window.localStorage.setItem(
		'twine-TEST-automerge-urls',
		JSON.stringify(serialized)
	);
}

/**
 * Returns all story handles in Automerge.
 */
export function allStoryDocHandles() {
	return Object.values(storyAutomergeDocs);
}

/**
 * Returns an Automerge doc handle for a story, creating it if need be.
 */
export function getOrCreateDocHandleForStory(story: Story) {
	if (!story.ifid) {
		throw new Error(
			"Can't get or create a doc handle for a story that has no IFID"
		);
	}

	// Return existing if we have one.

	if (story.ifid in storyAutomergeDocs) {
		return storyAutomergeDocs[story.ifid];
	}

	// Create it in the repo.

	console.log(`Creating Automerge handle for story ${story.ifid}`);

	const docHandle = repo.create(story);

	// Add it to the lookup map and serialize it to local storage.

	storyAutomergeDocs[story.ifid] = docHandle;
	saveStoryDocHandles();
	return docHandle;
}
