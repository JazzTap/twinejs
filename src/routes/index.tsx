import * as React from 'react';
import {HashRouter, Route, Switch} from 'react-router-dom';
import {usePrefsContext} from '../store/prefs';
import {StoryEditRoute} from './story-edit';
import {StoryListRoute} from './story-list';
import {StoryPlayRoute} from './story-play';
import {StoryProofRoute} from './story-proof';
import {StoryTestRoute} from './story-test';
import {WelcomeRoute} from './welcome';
import {
  BroadcastChannelNetworkAdapter,
  WebSocketClientAdapter,
  IndexedDBStorageAdapter,
   RepoContext,
   Repo } from '../../automerge-repo/packages/automerge-react/src'

console.log('consumer context', RepoContext)

const repo = new Repo({
  network: [new BroadcastChannelNetworkAdapter(),
	    	new WebSocketClientAdapter("wss://sync.automerge.org"), // duck-composed-closely.ngrok-free.app
  ], // FIXME
  storage: new IndexedDBStorageAdapter(),
});

export const Routes: React.FC = () => {
	const {prefs} = usePrefsContext();

	// A <HashRouter> is used to make our lives easier--to load local story
	// formats, we need the document HREF to reflect where the HTML file is.
	// Otherwise we'd have to store the actual location somewhere, which will
	// differ between web and Electron contexts.

	return (
		<RepoContext.Provider value={repo}>
			<HashRouter>
				{prefs.welcomeSeen ? (
					<Switch>
						<Route exact path="/">
							<StoryListRoute />
						</Route>
						<Route path="/welcome">
							<WelcomeRoute />
						</Route>
						<Route path="/stories/:storyId/play">
							<StoryPlayRoute />
						</Route>
						<Route path="/stories/:storyId/proof">
							<StoryProofRoute />
						</Route>
						<Route path="/stories/:storyId/test/:passageId">
							<StoryTestRoute />
						</Route>
						<Route path="/stories/:storyId/test">
							<StoryTestRoute />
						</Route>
						<Route path="/stories/:storyId">
							<StoryEditRoute repo={repo} />
						</Route>
						<Route
							path="*"
							render={path => {
								console.warn(
									`No route for path "${path.location.pathname}", rendering story list`
								);
								return <StoryListRoute />;
							}}
						></Route>
					</Switch>
				) : (
					<WelcomeRoute />
				)}
			</HashRouter>
		</RepoContext.Provider>
	);
};
