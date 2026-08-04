import {storyWithId, storyWithName} from '../../../stories/getters';
import {
	StoriesAction,
	StoriesState,
	Story
} from '../../../stories/stories.types';
import {getOrCreateDocHandleForStory} from './repo';

export function saveMiddleware(state: StoriesState, action: StoriesAction) {
	console.log("automerge middleware", state, action)

	switch (action.type) {
		case 'createStory': {
			if (!action.props.name) {
				throw new Error('Story was created but with no name specified');
			}
			getOrCreateDocHandleForStory(storyWithName(state, action.props.name));
			break;
		}

		case 'updatePassage':
		case 'updatePassages': {
			const story = storyWithId(state, action.storyId);
			const docHandle = getOrCreateDocHandleForStory(story);
		
			// const newState = reducer(state, action);
			// const updated = storyWithId(newState, action.storyId);

			// write to server
			docHandle.change((d: Story) => {
				d.passages = story.passages
				d.lastUpdate = story.lastUpdate
			});
			break;
		}

		case 'updateStory': {
			if (action.source === 'persistence') {
				// This came from us originally. We don't want to re-process this change.
				return;
			}

			const story = storyWithId(state, action.storyId);
			const docHandle = getOrCreateDocHandleForStory(story);

			console.log('Changing Automerge doc', action.props);
			docHandle.change((edit: Story) => {
				for (const prop in action.props) {
					if (Array.isArray(action.props[prop])) {
						// Skip these for now because we need to reconcile them precisely.
						console.log(`Skipping changing ${prop}`);
						continue;
					}

					edit[prop] = action.props[prop];
				}
			});
			break;
		}
	}
}
