import {storyWithIdOrUndefined, storyWithName} from '../../../stories/getters';
import {
	StoriesAction,
	StoriesState,
	Story,
	Passage
} from '../../../stories/stories.types';
import {getOrCreateDocHandleForStory} from './repo';

export async function saveMiddleware(state: StoriesState, action: StoriesAction) {
	console.log("automerge middleware", state, action)

	switch (action.type) {
		// passage-level edits have already been actioned by the reducer into `state`
		case 'createPassage':
		case 'createPassages': {
			const story = storyWithIdOrUndefined(state, action.storyId);
			if (!story || story.isProvisional) break;

			const docHandle = await getOrCreateDocHandleForStory(story);

			docHandle.change((d: Story) => {
				const existingIds = new Set(d.passages.map(p => p.id));
				story.passages.forEach(p => {
					if (!existingIds.has(p.id)) {
						d.passages.push(p);
					}
				});
				d.lastUpdate = story.lastUpdate;
			});
			break;
		}

		case 'updatePassage':
		case 'updatePassages': {
			const story = storyWithIdOrUndefined(state, action.storyId);
			if (!story || story.isProvisional) break;

			const docHandle = await getOrCreateDocHandleForStory(story);
			const updates: Record<string, Partial<Passage>> =
				action.type === 'updatePassage'
					? {[action.passageId]: action.props}
					: action.passageUpdates;

			docHandle.change((d: Story) => {
				for (const id in updates) {
					const passage = d.passages.find(p => p.id === id);
					if (passage) Object.assign(passage, updates[id]);
				}
				d.lastUpdate = story.lastUpdate;
			});
			break;
		}
		
		case 'createStory': {
			if (!action.props.name) {
				throw new Error('Story was created but with no name specified');
			}
			await getOrCreateDocHandleForStory(storyWithName(state, action.props.name));
			break;
		}

		case 'updateStory': {
			if (action.source === 'persistence') {
				// This came from us originally. We don't want to re-process this change.
				return;
			}

			const story = storyWithIdOrUndefined(state, action.storyId);
			if (!story || story.isProvisional) {
				break;
			}

			const docHandle = await getOrCreateDocHandleForStory(story);

			console.log('Changing Automerge doc', action.props);
			docHandle.change((edit: Story) => {
				let prop: keyof typeof action.props; // Tell Typescript to accept dynamic props.
				for (prop in action.props) {
					if (Array.isArray(action.props[prop])) {
						// Skip these for now because we need to reconcile them precisely.
						console.log(`Skipping changing ${prop}`);
						continue;
					}

					edit[prop] = action.props[prop] as never; // Force the assignment.
				}
			});
			break;
		}
	}
}