import * as React from 'react';
import {useParams} from 'react-router-dom';
import {MainContent} from '../../components/container/main-content';
import {DocumentTitle} from '../../components/document-title/document-title';
import {DialogsContextProvider} from '../../dialogs';
import { usePrefsContext } from '../../store/prefs';
import {Story, storyWithIFId} from '../../store/stories';
import {
	UndoableStoriesContextProvider,
	useUndoableStoriesContext
} from '../../store/undoable-stories';
import {MarqueeablePassageMap} from './marqueeable-passage-map';
import {PassageFuzzyFinder} from './passage-fuzzy-finder';
import {StoryEditToolbar} from './toolbar';
import {useInitialPassageCreation} from './use-initial-passage-creation';
import {usePassageChangeHandlers} from './use-passage-change-handlers';
import {useViewCenter} from './use-view-center';
import {useZoomShortcuts} from './use-zoom-shortcuts';
import {useZoomTransition} from './use-zoom-transition';
import { AutomergeUrl, Repo } from "../../../automerge-repo/packages/automerge-react/src"
import './story-edit-route.css';

// FIXME: hardcoded config pointing to live server.
// FIXME: stand up development Automerge server on localhost alongside Vite.
const DEBUG_LOCAL = false
const serverURL = "https://duck-composed-closely.ngrok-free.app"

// skip POST if DEBUG_LOCAL says we're on localhost, since CORS will fail
function fetchOrElse(url: URL, options: RequestInit) {
    if (DEBUG_LOCAL) { return {json: () => ({}) }; }
    return fetch(url, options)
}

export const InnerStoryEditRoute: React.FC<{repo: Repo}> = ({repo}) => {
	const {ifid} = useParams<{ifid: string}>();
	const {prefs} = usePrefsContext();
	const {dispatch, stories, storyUrl} = useUndoableStoriesContext();
	const story = storyWithIFId(stories, ifid);
	const storyId = story.id;
	
	const [fuzzyFinderOpen, setFuzzyFinderOpen] = React.useState(false);
	const mainContent = React.useRef<HTMLDivElement>(null);
	const {getCenter, setCenter} = useViewCenter(story, mainContent);
	const {
		handleDeselectPassage,
		handleDragPassages,
		handleEditPassage,
		handleSelectPassage,
		handleSelectRect
	} = usePassageChangeHandlers(story);
	const visibleZoom = useZoomTransition(story.zoom, mainContent.current);

	useZoomShortcuts(story);
	useInitialPassageCreation(story, getCenter);

	React.useEffect(() => {

		// look up a canonical story by guid
		async function lookup() {
			let headers = { "Content-Type": "application/json", }

			// use the story ID to look up an Automerge URL
			let instanceRaw = storyId
			let req = await fetchOrElse(new URL(`${serverURL}/api/handle`), {
				method: "POST",
				headers,
				body: JSON.stringify({"iid": instanceRaw})
			})
			let res = ((await req.json()) as any).result
			let instance;

			if (res === false) {
				// assign each unknown story ID a fresh Automerge URL
				let handle = repo.create<Story>(story);
				instance = handle.url
				let urlSlug = handle.url.split(':')[1]

				// tell the server our instance slug
				console.log("assign handle: ", JSON.stringify({"handle": urlSlug, "iid": storyId}))
				fetchOrElse(new URL(`${serverURL}/api/assign`), {
					method: "POST",
					headers,
					body: JSON.stringify({"handle": urlSlug, "iid": storyId})}
				)
			} else {
				console.log("found handle: ", 
					JSON.stringify({"handle": res,
									"iid": storyId}))
				instance = 'automerge:' + res as AutomergeUrl
			}

			storyUrl.current = instance
		}

		// FIXME: get Automerge doc handle if it went stale, i.e. we switched stories
		// if (storyUrl.current === undefined) { storyUrl.current = await lookup() }
		if (storyUrl.current === undefined) {
			lookup()
			// FIXME: queue incoming edits until storyUrl.current resolves to an instance
			// dispatch(
				// updateStory(stories, stories[0], {name: 'mock-story-rename'})
			// )
		}
	}, [])

	return (
		<div className="story-edit-route">
			<DocumentTitle title={story.name} />
			<StoryEditToolbar
				getCenter={getCenter}
				onOpenFuzzyFinder={() => setFuzzyFinderOpen(true)}
				story={story}
			/>
			<MainContent grabbable padded={false} ref={mainContent}>
				<MarqueeablePassageMap
					container={mainContent}
					formatName={story.storyFormat}
					formatVersion={story.storyFormatVersion}
					onDeselect={handleDeselectPassage}
					onDrag={handleDragPassages}
					onEdit={handleEditPassage}
					onSelect={handleSelectPassage}
					onSelectRect={handleSelectRect}
					passages={story.passages}
					startPassageId={story.startPassage}
					tagColors={story.tagColors}
					tagDisplay={prefs.passageTagDisplay}
					visibleZoom={visibleZoom}
					zoom={story.zoom}
				/>
				<PassageFuzzyFinder
					onClose={() => setFuzzyFinderOpen(false)}
					onOpen={() => setFuzzyFinderOpen(true)}
					open={fuzzyFinderOpen}
					setCenter={setCenter}
					story={story}
				/>
			</MainContent>
		</div>
	);
};

// This is a separate component so that the inner one can use
// `useDialogsContext()` and `useUndoableStoriesContext()` inside it.

export const StoryEditRoute: React.FC<{repo: Repo}> = ({repo}) => (
	<UndoableStoriesContextProvider>
		<DialogsContextProvider>
			<InnerStoryEditRoute repo={repo} />
		</DialogsContextProvider>
	</UndoableStoriesContextProvider>
);
