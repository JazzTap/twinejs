import {
	AnyDocumentId,
	BroadcastChannelNetworkAdapter,
	DocHandle,
	IndexedDBStorageAdapter,
	WebSocketClientAdapter,
	Repo
} from '@automerge/vanillajs';
import {Story} from '../../../stories/stories.types';

/**
 * Base URL of the sync server's REST API, used for handle lookup/registration.
 */
const SERVER_URL = 'https://duck-composed-closely.ngrok-free.app';
const SERVER_SOCKET_URL = 'wss://duck-composed-closely.ngrok-free.app';

/**
 * Shared repo for all Automerge documents.
 */
export const repo = new Repo({
	// Using local broadcast only for now; can't communicate with external
	// server when running on localhost without CORS being set up over there.
	network: [
		// @ts-expect-error TODO: upstream Automerge types have gotten stale, share a report
		new BroadcastChannelNetworkAdapter(),
		// @ts-expect-error same upstream Automerge type error as BroadcastChannel... adapter
		new WebSocketClientAdapter(SERVER_SOCKET_URL), 
	],
	storage: new IndexedDBStorageAdapter()
});

// Exposing it globally for debugging.
declare global {
	interface Window {
		repo?: Repo;
	}
}
window.repo = repo;

/**
 * A local map of story IFIDs -> Automerge doc URLs.
 */
const storyAutomergeDocs: Record<string, DocHandle<Story>> = {};
/**
 * In-flight get-or-create promises, keyed by IFID.
 */
const pendingDocHandles: Record<string, Promise<DocHandle<Story>>> = {};

/**
 * Tracks story objects (by reference) that have already been passed to
 * repo.create() - speculatively guards against re-used object references.
 */
const createdStoryObjects = new WeakSet<object>();

/**
 * Loads the map of story IFIDs -> Automerge doc handles from local storage.
 */
export async function loadStoryDocHandles() {
	const savedUrls = window.localStorage.getItem('twine-TEST-automerge-urls');

	if (savedUrls) {
		let parsedSavedUrls: Record<string, string> = {};

		try {
			parsedSavedUrls = JSON.parse(savedUrls);
		} catch {
			console.error("Couldn't parse Automerge URL map in local storage");
		}

		for (const key in parsedSavedUrls) {
			try {
				const pending = repo.find(parsedSavedUrls[key] as AnyDocumentId);

				pendingDocHandles[key] = pending;
				storyAutomergeDocs[key] = await pending;
				console.log(`[repo] Hydrated local handle for ${key} from local storage`);
			} catch {
				console.error(`Couldn't find document ${key} in Automerge; skipping`);
			} finally {
				delete pendingDocHandles[key];
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
 * Looks up a previously-assigned Automerge document handle for a story IFID
 * on the remote server. Returns the handle string, or undefined.
 */
async function lookupRemoteHandle(ifid: string): Promise<string | undefined> {
	try {
		const response = await fetch(`${SERVER_URL}/api/handle`, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({iid: ifid})
		});

		if (!response.ok) {
			console.error(`Handle lookup failed for ${ifid}: ${response.status}`);
			return undefined;
		}

		const {result} = await response.json();

		if (result !== false) {
			console.log(`[repo] Remote lookup succeeded for ${ifid} -> ${result}`);
		}

		return result === false ? undefined : result;
	} catch (error) {
		console.error(`Handle lookup errored for ${ifid}`, error);
		return undefined;
	}
}

/**
 * Registers a newly-created document's handle with the server so other
 * clients can find it by IFID.
 */
async function assignRemoteHandle(ifid: string, handle: string) {
	try {
		const response = await fetch(`${SERVER_URL}/api/assign`, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({iid: ifid, handle})
		});

		if (!response.ok) {
			console.error(`Handle assignment failed for ${ifid}: ${response.status}`);
		} else {
			console.log(`[repo] Remote assignment succeeded for ${ifid} -> ${handle}`);
		}
	} catch (error) {
		console.error(`Handle assignment errored for ${ifid}`, error);
	}
}

/**
 * Returns an Automerge doc handle for a story, keyed by IFID, creating it if need be.
 * FIXME: Down the road we should warn on IFID collision; blocked on user authentication.
 */
export async function getOrCreateDocHandleForStory(story: Story) {
	if (!story.ifid) {
		throw new Error(
			"Can't get or create a doc handle for a story that has no IFID"
		);
	}

	console.log(
		`[repo] getOrCreateDocHandleForStory called for ${story.ifid}`,
		{cached: story.ifid in storyAutomergeDocs, pending: story.ifid in pendingDocHandles}
	);

	// Return existing if we already have one locally.

	if (story.ifid in storyAutomergeDocs) {
		return storyAutomergeDocs[story.ifid];
	}

	// If a get-or-create for this IFID is already underway, piggyback on it
	// instead of racing it into repo.create() with the same story object.

	if (story.ifid in pendingDocHandles) {
		return pendingDocHandles[story.ifid];
	}

	const pending = (async () => {
		// Ask the server if a handle already exists for this IFID.

		const remoteHandle = await lookupRemoteHandle(story.ifid);

		if (remoteHandle) {
			try {
				const docHandle = await repo.find(remoteHandle as AnyDocumentId);

				console.log(
					`[repo] repo.find succeeded for ${story.ifid} -> ${remoteHandle}`
				);
				storyAutomergeDocs[story.ifid] = docHandle;
				saveStoryDocHandles();
				return docHandle;
			} catch {
				console.error(
					`Server had a handle for ${story.ifid} but it couldn't be found in Automerge; creating a new one`
				);
			}
		}

		// Not found locally or remotely (or remote find failed) — create it.
		//
		// Diagnostic: warn loudly if this exact story object has already been
		// passed to repo.create() before. This points to a shared/reused
		// object reference (e.g. a default `passages` array, or a story
		// object cloned from Automerge's own document state) as the real
		// cause of "Cannot create a reference to an existing document
		// object", independent of the ifid-based caching above.

		if (createdStoryObjects.has(story)) {
			console.error(
				`[repo] DIAGNOSTIC: story object for ${story.ifid} was already passed to repo.create() once before. ` +
					`This will throw "Cannot create a reference to an existing document object". ` +
					`Check for a shared/reused object reference (e.g. default passages array) in the reducer/action that produced this story.`,
				story
			);
		}

		createdStoryObjects.add(story);

		console.log(`[repo] Creating Automerge handle for story ${story.ifid}`);

		let docHandle: DocHandle<Story>;

		try {
			docHandle = repo.create(story);
		} catch (error) {
			console.error(
				`[repo] repo.create() failed for ${story.ifid}. story object:`,
				story,
				'error:',
				error
			);
			throw error;
		}

		// Add it to the lookup map, persist locally, and register with the server.

		storyAutomergeDocs[story.ifid] = docHandle;
		saveStoryDocHandles();
		await assignRemoteHandle(story.ifid, docHandle.documentId);

		return docHandle;
	})();

	pendingDocHandles[story.ifid] = pending;

	try {
		return await pending;
	} finally {
		delete pendingDocHandles[story.ifid];
	}
}